import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalEventStore } from "@/lib/persistence/event-store";
import { reconstructGameState } from "@/lib/persistence/replay";
import { chooseBotAction, createDefaultBotProfiles } from "./bots";
import { nextPlayer } from "./deck";
import { createInitialGameState, dispatchAction } from "./engine";
import { legalActionsForPlayer, scoreHand } from "./rules";
import type { Card, GameAction, GameState } from "./types";

const testDirs: string[] = [];
const bots = createDefaultBotProfiles();
const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

afterEach(async () => {
  await Promise.all(testDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("full game loop", () => {
  it("rotates dealer after each completed hand", () => {
    const firstComplete = makeCompletedHandState({ dealer: 0, handNumber: 1 });
    const second = dispatchAction(firstComplete, { type: "NEXT_HAND", seed: 200 });
    const secondComplete = {
      ...second,
      phase: "handComplete" as const
    };
    const third = dispatchAction(secondComplete, { type: "NEXT_HAND", seed: 300 });

    expect(second.dealer).toBe(1);
    expect(second.activePlayer).toBe(2);
    expect(third.dealer).toBe(2);
    expect(third.activePlayer).toBe(3);
  });

  it("preserves cumulative score across hands", () => {
    const first = playControlledHand(createInitialGameState({ targetScore: 10 }));
    const secondDeal = dispatchAction(first, { type: "NEXT_HAND", seed: 222 });
    const second = playControlledHand(secondDeal);

    expect(first.scores).toEqual([2, 0]);
    expect(secondDeal.scores).toEqual([2, 0]);
    expect(second.scores).toEqual([4, 0]);
  });

  it("resets hand-specific state cleanly for the next deal", () => {
    const complete = makeCompletedHandState({
      dealer: 0,
      handNumber: 1,
      scores: [2, 0],
      hands: {
        0: [c("A", "clubs")],
        1: [c("A", "diamonds")],
        2: [c("A", "hearts")],
        3: [c("A", "spades")]
      },
      kitty: [c("9", "clubs")],
      upcard: c("9", "clubs"),
      turnedDownSuit: "clubs",
      trump: "hearts",
      maker: 1,
      makerTeam: 1,
      lonePlayer: 1,
      bids: [{ round: 2, player: 1, decision: "call", suit: "hearts", alone: true }],
      completedTricks: [{
        leader: 1,
        plays: [
          { player: 1, card: c("A", "hearts") },
          { player: 2, card: c("9", "hearts") },
          { player: 3, card: c("10", "hearts") },
          { player: 0, card: c("Q", "hearts") }
        ],
        winner: 1
      }],
      tricksWon: [0, 1]
    });

    const next = dispatchAction(complete, { type: "NEXT_HAND", seed: 333 });

    expect(next.phase).toBe("ordering");
    expect(next.handNumber).toBe(2);
    expect(next.dealer).toBe(1);
    expect(next.activePlayer).toBe(2);
    expect(next.scores).toEqual([2, 0]);
    expect(Object.values(next.hands).map((hand) => hand.length)).toEqual([5, 5, 5, 5]);
    expect(next.kitty).toHaveLength(4);
    expect(next.upcard).toBeDefined();
    expect(next.bids).toEqual([]);
    expect(next.currentTrick).toBeNull();
    expect(next.completedTricks).toEqual([]);
    expect(next.tricksWon).toEqual([0, 0]);
    expect(next.trump).toBeUndefined();
    expect(next.maker).toBeUndefined();
    expect(next.makerTeam).toBeUndefined();
    expect(next.lonePlayer).toBeUndefined();
    expect(next.handResult).toBeUndefined();
  });

  it("reconstructs persisted replay across at least three hands", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 101 } });

    let loaded = await store.loadGame(game.id);
    for (let index = 0; index < 220 && (loaded.state.handNumber < 3 || loaded.state.phase !== "handComplete"); index += 1) {
      const action = loaded.state.phase === "handComplete"
        ? { type: "NEXT_HAND", seed: 101 + loaded.state.handNumber } as GameAction
        : chooseNextAction(loaded.state);

      expect(action).not.toBeNull();
      await store.appendMove({
        gameId: game.id,
        expectedSequence: loaded.events.length,
        action: action as GameAction
      });
      loaded = await store.loadGame(game.id);
    }

    const reconstructed = reconstructGameState(loaded.events, loaded.game.config, loaded.game.id);

    expect(loaded.state.handNumber).toBe(3);
    expect(loaded.state.phase).toBe("handComplete");
    expect(loaded.events.filter((event) => event.eventType === "NEXT_HAND")).toHaveLength(2);
    expect(loaded.events.map((event) => event.sequenceNumber)).toEqual(loaded.events.map((_, index) => index));
    expect(loaded.state).toEqual(reconstructed);
  }, 30_000);

  it("completes a persisted game when a team reaches 10 and rejects another hand", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 501 } });

    const loaded = await drivePersistedGame(store, game.id, 600);

    expect(loaded.state.phase).toBe("gameComplete");
    expect(loaded.state.scores.some((score) => score >= 10)).toBe(true);
    expect(loaded.game.status).toBe("complete");
    expect(loaded.game.completedAt).toBeDefined();
    await expect(store.appendMove({
      gameId: game.id,
      expectedSequence: loaded.events.length,
      action: { type: "NEXT_HAND", seed: 999 }
    })).rejects.toThrow(/already complete/);
  }, 30_000);

  it("marks gameComplete when controlled scoring reaches the target", () => {
    const finished = playControlledHand(createInitialGameState({ targetScore: 2 }));

    expect(finished.phase).toBe("gameComplete");
    expect(finished.scores).toEqual([2, 0]);
    expect(() => dispatchAction(finished, { type: "NEXT_HAND", seed: 123 })).toThrow(/already complete/);
  });
});

function chooseNextAction(state: GameState): GameAction | null {
  const bot = bots.find((candidate) => candidate.seat === state.activePlayer);
  if (bot) {
    return chooseBotAction(state, bot);
  }

  const legal = legalActionsForPlayer(state, 0);
  if (state.phase === "ordering" && legal.canPass) {
    return { type: "PASS", player: 0 };
  }

  if (state.phase === "calling") {
    if (legal.canPass) {
      return { type: "PASS", player: 0 };
    }

    const suit = legal.callableSuits[0];
    return suit ? { type: "CALL_TRUMP", player: 0, suit } : null;
  }

  if (state.phase === "discarding") {
    const card = state.hands[0][0];
    return card ? { type: "DISCARD", player: 0, card } : null;
  }

  if (state.phase === "playing") {
    const card = legal.playableCards[0];
    return card ? { type: "PLAY_CARD", player: 0, card } : null;
  }

  return null;
}

async function drivePersistedGame(store: LocalEventStore, gameId: string, maxActions: number) {
  let loaded = await store.loadGame(gameId);

  for (let index = 0; index < maxActions && loaded.state.phase !== "gameComplete"; index += 1) {
    const action = loaded.state.phase === "handComplete"
      ? { type: "NEXT_HAND", seed: 700 + loaded.state.handNumber } as GameAction
      : chooseNextAction(loaded.state);

    expect(action).not.toBeNull();
    await store.appendMove({
      gameId,
      expectedSequence: loaded.events.length,
      action: action as GameAction
    });
    loaded = await store.loadGame(gameId);
  }

  return loaded;
}

function playControlledHand(base: GameState): GameState {
  let state = makeControlledPlayingState(base);

  while (state.phase === "playing") {
    const player = state.activePlayer;
    const card = legalActionsForPlayer(state, player).playableCards[0];
    state = dispatchAction(state, { type: "PLAY_CARD", player, card });
  }

  return state;
}

function makeControlledPlayingState(base: GameState): GameState {
  return {
    ...base,
    phase: "playing",
    handNumber: Math.max(base.handNumber, 1),
    dealer: 3,
    activePlayer: 0,
    trump: "clubs",
    maker: 0,
    makerTeam: 0,
    lonePlayer: undefined,
    hands: {
      0: [c("A", "clubs"), c("K", "clubs"), c("Q", "clubs"), c("10", "clubs"), c("9", "clubs")],
      1: [c("9", "diamonds"), c("10", "diamonds"), c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")],
      2: [c("9", "hearts"), c("10", "hearts"), c("Q", "hearts"), c("K", "hearts"), c("A", "hearts")],
      3: [c("9", "spades"), c("10", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")]
    },
    currentTrick: {
      leader: 0,
      plays: []
    },
    completedTricks: [],
    tricksWon: [0, 0],
    handResult: undefined
  };
}

function makeCompletedHandState(overrides: Partial<GameState>): GameState {
  const dealer = overrides.dealer ?? 0;
  return {
    ...createInitialGameState({ targetScore: 10 }),
    phase: "handComplete",
    handNumber: 1,
    dealer,
    activePlayer: nextPlayer(dealer),
    scores: [2, 0],
    hands: {
      0: [],
      1: [],
      2: [],
      3: []
    },
    kitty: [],
    bids: [],
    currentTrick: null,
    completedTricks: [],
    tricksWon: [5, 0],
    handResult: scoreHand({
      makerTeam: 0,
      maker: 0,
      trump: "clubs",
      tricksWon: [5, 0]
    }),
    ...overrides
  };
}

async function createStore(): Promise<LocalEventStore> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "euchre-game-loop-store-"));
  testDirs.push(dir);
  return new LocalEventStore(path.join(dir, "events.json"));
}
