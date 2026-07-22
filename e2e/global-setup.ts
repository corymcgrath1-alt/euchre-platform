import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";
import {
  cardId,
  chooseBotAction,
  createDefaultBotProfiles,
  legalActionsForPlayer,
  type GameAction,
  type GameState
} from "../src/lib/euchre";
import { buildClubReplayTimeline } from "../src/lib/presentation/club/replay-timeline";
import type { PersistedMoveEventRecord } from "../src/lib/persistence/types";

export interface E2eFixture {
  runId: string;
  completeGameId: string;
  emptyGameId: string;
  activeGameId: string;
  finalScore: [number, number];
  totalReplaySteps: number;
  finalStepIndex: number;
  discardStepIndex: number;
  viewerCardIds: string[];
  opponentCardIds: string[];
  hiddenKittyCardIds: string[];
  hiddenDiscardCardId?: string;
}

export default async function globalSetup(config: FullConfig) {
  const fixturePath = requiredPath("EUCHRE_E2E_FIXTURE_PATH");
  const storePath = requiredPath("EUCHRE_LOCAL_EVENT_STORE_PATH");
  await mkdir(path.dirname(storePath), { recursive: true });
  await rm(storePath, { force: true });
  await rm(fixturePath, { force: true });

  const baseURL = String(config.projects[0]?.use.baseURL ?? "http://127.0.0.1:3005");
  const api = await request.newContext({ baseURL });
  const runId = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const completed = await createGame(api, runId, 5);
    const first = await append(api, completed.id, 0, { type: "START_HAND", seed: 78431 });
    const initialState = first.state;
    let state = first.state;
    let sequence = 1;

    for (let index = 0; index < 700 && state.phase !== "gameComplete"; index += 1) {
      const action = state.phase === "handComplete"
        ? { type: "NEXT_HAND", seed: 78431 + state.handNumber } as GameAction
        : nextAction(state);
      const result = await append(api, completed.id, sequence, action);
      state = result.state;
      sequence += 1;
    }
    if (state.phase !== "gameComplete") throw new Error("E2E fixture game did not complete");

    const eventsResponse = await api.get(`/api/games/${completed.id}/events`);
    if (!eventsResponse.ok()) throw new Error(`Unable to load fixture events: ${eventsResponse.status()}`);
    const { events } = await eventsResponse.json() as { events: PersistedMoveEventRecord[] };
    const timeline = buildClubReplayTimeline({
      gameId: completed.id,
      config: completed.config,
      events,
      viewerSeat: 0
    });
    const discardEvent = events.find((event) => event.eventType === "DISCARD" && event.player !== 0);
    const discardStepIndex = discardEvent
      ? timeline.steps.findIndex((step) => step.kind === "discard" && step.sequenceNumber === discardEvent.sequenceNumber)
      : -1;

    const empty = await createGame(api, `${runId}-empty`, 5);
    const active = await createGame(api, `${runId}-active`, 5);
    await append(api, active.id, 0, { type: "START_HAND", seed: 55119 });

    const fixture: E2eFixture = {
      runId,
      completeGameId: completed.id,
      emptyGameId: empty.id,
      activeGameId: active.id,
      finalScore: [...state.scores],
      totalReplaySteps: timeline.steps.length,
      finalStepIndex: timeline.steps.length - 1,
      discardStepIndex,
      viewerCardIds: initialState.hands[0].map(cardId),
      opponentCardIds: [1, 2, 3].flatMap((seat) => initialState.hands[seat as 1 | 2 | 3].map(cardId)),
      hiddenKittyCardIds: initialState.kitty
        .filter((card) => !initialState.upcard || cardId(card) !== cardId(initialState.upcard))
        .map(cardId),
      hiddenDiscardCardId: discardEvent?.payload.type === "DISCARD" ? cardId(discardEvent.payload.card) : undefined
    };
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2), "utf8");
  } finally {
    await api.dispose();
  }
}

async function createGame(api: Awaited<ReturnType<typeof request.newContext>>, runId: string, targetScore: number) {
  const response = await api.post("/api/games", {
    data: {
      config: {
        stickDealer: true,
        targetScore,
        botDifficulty: "standard",
        dealerSelection: "default",
        farmersHandMode: "off",
        lonerMode: "aloneOnly"
      },
      metadata: { source: "playwright-e2e", runId }
    }
  });
  if (!response.ok()) throw new Error(`Unable to create E2E game: ${response.status()} ${await response.text()}`);
  return (await response.json() as { game: { id: string; config: GameState["config"] } }).game;
}

async function append(
  api: Awaited<ReturnType<typeof request.newContext>>,
  gameId: string,
  expectedSequence: number,
  action: GameAction
): Promise<{ state: GameState }> {
  const response = await api.post(`/api/games/${gameId}/events`, { data: { expectedSequence, action } });
  if (!response.ok()) throw new Error(`Unable to append E2E event: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ state: GameState }>;
}

function nextAction(state: GameState): GameAction {
  const bot = createDefaultBotProfiles().find((candidate) => candidate.seat === state.activePlayer);
  if (bot) {
    const action = chooseBotAction(state, bot);
    if (action) return action;
  }
  const legal = legalActionsForPlayer(state, state.activePlayer);
  if (state.phase === "ordering") return { type: legal.canPass ? "PASS" : "ORDER_UP", player: state.activePlayer };
  if (state.phase === "calling") {
    if (legal.canPass) return { type: "PASS", player: state.activePlayer };
    const suit = legal.callableSuits[0];
    if (suit) return { type: "CALL_TRUMP", player: state.activePlayer, suit };
  }
  if (state.phase === "discarding") {
    const card = state.hands[state.activePlayer].find((candidate) => !state.upcard || cardId(candidate) !== cardId(state.upcard))
      ?? state.hands[state.activePlayer][0];
    return { type: "DISCARD", player: state.activePlayer, card };
  }
  if (state.phase === "playing") return { type: "PLAY_CARD", player: state.activePlayer, card: legal.playableCards[0] };
  if (state.phase === "farmersHand") return { type: "FARMERS_HAND_DECLINE", player: state.activePlayer };
  throw new Error(`No E2E action for ${state.phase}`);
}

function requiredPath(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for isolated E2E setup`);
  return value;
}
