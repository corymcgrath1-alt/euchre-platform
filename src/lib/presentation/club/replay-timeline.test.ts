import { describe, expect, it } from "vitest";
import {
  cardId,
  chooseBotAction,
  createDefaultBotProfiles,
  createInitialGameState,
  legalActionsForPlayer,
  reduceGameAction,
  type GameAction,
  type GameState
} from "@/lib/euchre";
import type { PersistedMoveEventRecord } from "@/lib/persistence/event-store";
import { buildGameReview } from "@/lib/review/game-review";
import { buildClubReplayTimeline } from "./replay-timeline";

describe("Club immutable replay timeline", () => {
  it("reconstructs deterministic public replay steps without mutating persisted events", () => {
    const source = buildCompletedTranscript();
    const before = JSON.stringify(source.events);
    const timeline = buildClubReplayTimeline({
      gameId: "timeline-game",
      config: source.initial.config,
      events: source.events,
      viewerSeat: 0
    });
    const review = buildGameReview({ gameId: "timeline-game", config: source.initial.config, events: source.events });

    expect(timeline.steps[0]).toMatchObject({ kind: "deal", sequenceNumber: 0 });
    expect(timeline.steps.some((step) => step.kind === "bid")).toBe(true);
    expect(timeline.steps.some((step) => step.kind === "card-play")).toBe(true);
    expect(timeline.steps.some((step) => step.kind === "trick-complete")).toBe(true);
    expect(timeline.steps.some((step) => step.kind === "hand-score")).toBe(true);
    expect(timeline.steps.at(-1)).toMatchObject({ kind: "final-result" });
    expect(timeline.steps.at(-1)?.table.scores).toEqual(review.finalScore);
    expect(JSON.stringify(source.events)).toBe(before);
    expect(buildClubReplayTimeline({
      gameId: "timeline-game",
      config: source.initial.config,
      events: source.events,
      viewerSeat: 0
    })).toEqual(timeline);
  }, 30_000);

  it("shows each viewer only their own hand at the deal step", () => {
    const source = buildCompletedTranscript();
    const firstState = reduceGameAction(source.initial, source.events[0].payload);
    const south = buildClubReplayTimeline({ gameId: "timeline-game", config: source.initial.config, events: source.events, viewerSeat: 0 });
    const north = buildClubReplayTimeline({ gameId: "timeline-game", config: source.initial.config, events: source.events, viewerSeat: 2 });
    const southDeal = JSON.stringify(south.steps[0].table);
    const northDeal = JSON.stringify(north.steps[0].table);

    expect(south.steps[0].table.viewerHand.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining(firstState.hands[0].map(cardId))
    );
    expect(north.steps[0].table.viewerHand.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining(firstState.hands[2].map(cardId))
    );
    for (const seat of [1, 2, 3] as const) {
      for (const card of firstState.hands[seat]) expect(southDeal).not.toContain(serializedCard(card));
    }
    for (const seat of [0, 1, 3] as const) {
      for (const card of firstState.hands[seat]) expect(northDeal).not.toContain(serializedCard(card));
    }
  }, 30_000);

  it("never exposes kitty contents, a hidden dealer discard, or future private cards", () => {
    const source = buildCompletedTranscript();
    const firstState = reduceGameAction(source.initial, source.events[0].payload);
    const viewer = firstState.dealer === 2 ? 0 : 2;
    const timeline = buildClubReplayTimeline({ gameId: "timeline-game", config: source.initial.config, events: source.events, viewerSeat: viewer });
    const deal = JSON.stringify(timeline.steps[0]);
    const hiddenKitty = firstState.kitty.filter((card) => cardId(card) !== (firstState.upcard ? cardId(firstState.upcard) : ""));
    for (const card of hiddenKitty) expect(deal).not.toContain(serializedCard(card));

    const discardEvent = source.events.find((event) => event.eventType === "DISCARD");
    expect(discardEvent?.payload.type).toBe("DISCARD");
    if (discardEvent?.payload.type === "DISCARD") {
      const discardStep = timeline.steps.find((step) => step.kind === "discard" && step.sequenceNumber === discardEvent.sequenceNumber);
      expect(discardStep?.detail).toBe("The discarded card remains private");
      expect(JSON.stringify(discardStep)).not.toContain(serializedCard(discardEvent.payload.card));
      expect(JSON.stringify(discardStep)).not.toContain(cardId(discardEvent.payload.card));
    }
  }, 30_000);
});

function buildCompletedTranscript(): { initial: GameState; events: PersistedMoveEventRecord[] } {
  const initial = createInitialGameState({ targetScore: 5, stickDealer: true });
  const events: PersistedMoveEventRecord[] = [];
  let state = initial;
  let action: GameAction = { type: "START_HAND", seed: 24680 };

  for (let index = 0; index < 600; index += 1) {
    events.push(record(events.length, action));
    state = reduceGameAction(state, action);
    if (state.phase === "gameComplete") return { initial, events };
    action = state.phase === "handComplete"
      ? { type: "NEXT_HAND", seed: 24680 + state.handNumber }
      : nextAction(state);
  }

  throw new Error("Deterministic replay fixture did not complete");
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
  throw new Error(`No fixture action for ${state.phase}`);
}

function record(sequenceNumber: number, payload: GameAction): PersistedMoveEventRecord {
  return {
    id: `event-${sequenceNumber}`,
    gameId: "timeline-game",
    sequenceNumber,
    player: "player" in payload ? payload.player : undefined,
    eventType: payload.type,
    payload: JSON.parse(JSON.stringify(payload)) as GameAction,
    createdAt: `2026-01-01T00:${String(Math.floor(sequenceNumber / 60)).padStart(2, "0")}:${String(sequenceNumber % 60).padStart(2, "0")}.000Z`
  };
}

function serializedCard(card: { rank: string; suit: string }): string {
  return `\"rank\":\"${card.rank}\",\"suit\":\"${card.suit}\"`;
}
