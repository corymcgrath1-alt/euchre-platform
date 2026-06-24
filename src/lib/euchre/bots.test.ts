import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalEventStore } from "@/lib/persistence/event-store";
import {
  chooseBotAction,
  chooseDealerDiscard,
  chooseFarmersHandAction,
  chooseRoundOneBid,
  chooseRoundTwoCall,
  createDefaultBotProfiles,
  shouldGoAlone
} from "./bots";
import { createInitialGameState } from "./engine";
import { legalActionsForPlayer } from "./rules";
import type { BidDecision, Card, GameAction, GameState, PlayerIndex, Suit, Trick } from "./types";

const testDirs: string[] = [];
const bots = createDefaultBotProfiles();
const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

afterEach(async () => {
  await Promise.all(testDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("deterministic bot bidding", () => {
  it("orders up with right bower and strong trump support", () => {
    const state = makeOrderingState({
      player: 1,
      dealer: 3,
      upcard: c("9", "hearts"),
      hand: [c("J", "hearts"), c("J", "diamonds"), c("A", "hearts"), c("9", "clubs"), c("10", "spades")]
    });

    expect(chooseRoundOneBid(state, 1)).toEqual({ type: "ORDER_UP", player: 1, alone: true });
  });

  it("passes a weak upcard suit", () => {
    const state = makeOrderingState({
      player: 1,
      dealer: 3,
      upcard: c("9", "spades"),
      hand: [c("9", "clubs"), c("10", "diamonds"), c("Q", "hearts"), c("K", "clubs"), c("A", "diamonds")]
    });

    expect(chooseRoundOneBid(state, 1)).toEqual({ type: "PASS", player: 1 });
  });

  it("is more willing to order up when partner is dealer", () => {
    const hand = [c("A", "hearts"), c("K", "hearts"), c("9", "clubs"), c("10", "spades"), c("Q", "diamonds")];
    const partnerDealer = makeOrderingState({ player: 1, dealer: 3, upcard: c("9", "hearts"), hand });
    const opponentDealer = makeOrderingState({ player: 1, dealer: 0, upcard: c("9", "hearts"), hand });

    expect(chooseRoundOneBid(partnerDealer, 1)).toEqual({ type: "ORDER_UP", player: 1, alone: false });
    expect(chooseRoundOneBid(opponentDealer, 1)).toEqual({ type: "PASS", player: 1 });
  });

  it("easy passes a marginal hand that standard and strong call", () => {
    const state = makeOrderingState({
      player: 1,
      dealer: 3,
      upcard: c("9", "hearts"),
      hand: [c("A", "hearts"), c("K", "hearts"), c("9", "clubs"), c("10", "spades"), c("Q", "diamonds")]
    });

    expect(chooseRoundOneBid(state, 1, "easy")).toEqual({ type: "PASS", player: 1 });
    expect(chooseRoundOneBid(state, 1, "standard")).toEqual({ type: "ORDER_UP", player: 1, alone: false });
    expect(chooseRoundOneBid(state, 1, "strong")).toEqual({ type: "ORDER_UP", player: 1, alone: false });
  });

  it("calls next in round 2 with reasonable next-suit strength", () => {
    const state = makeCallingState({
      player: 1,
      dealer: 0,
      turnedDownSuit: "hearts",
      hand: [c("J", "hearts"), c("A", "diamonds"), c("K", "diamonds"), c("9", "clubs"), c("10", "spades")]
    });

    expect(chooseRoundTwoCall(state, 1)).toEqual({ type: "CALL_TRUMP", player: 1, suit: "diamonds", alone: false });
  });

  it("chooses legal trump when stick-the-dealer forces a call", () => {
    const state = makeCallingState({
      player: 0,
      dealer: 0,
      stickDealer: true,
      turnedDownSuit: "clubs",
      roundTwoPasses: 3,
      hand: [c("9", "clubs"), c("10", "diamonds"), c("Q", "hearts"), c("K", "clubs"), c("A", "diamonds")]
    });
    const action = chooseRoundTwoCall(state, 0);

    expect(action).toMatchObject({ type: "CALL_TRUMP", player: 0 });
    expect(action?.type === "CALL_TRUMP" ? action.suit : "clubs").not.toBe("clubs");
  });

  it("strong calls strong hands and avoids weak calls", () => {
    const strongState = makeCallingState({
      player: 1,
      dealer: 0,
      turnedDownSuit: "clubs",
      hand: [c("J", "spades"), c("A", "spades"), c("K", "spades"), c("9", "hearts"), c("A", "diamonds")]
    });
    const weakState = makeCallingState({
      player: 1,
      dealer: 0,
      turnedDownSuit: "clubs",
      hand: [c("9", "hearts"), c("10", "diamonds"), c("Q", "clubs"), c("K", "hearts"), c("A", "diamonds")]
    });

    expect(chooseRoundTwoCall(strongState, 1, "strong")).toEqual({ type: "CALL_TRUMP", player: 1, suit: "spades", alone: true });
    expect(chooseRoundTwoCall(weakState, 1, "strong")).toEqual({ type: "PASS", player: 1 });
  });

  it("only goes alone with very strong hands", () => {
    expect(shouldGoAlone([
      c("J", "hearts"),
      c("J", "diamonds"),
      c("A", "hearts"),
      c("9", "clubs"),
      c("A", "spades")
    ], "hearts")).toBe(true);

    expect(shouldGoAlone([
      c("A", "hearts"),
      c("K", "hearts"),
      c("9", "clubs"),
      c("10", "spades"),
      c("Q", "diamonds")
    ], "hearts")).toBe(false);

    expect(shouldGoAlone([
      c("J", "hearts"),
      c("J", "diamonds"),
      c("A", "hearts"),
      c("K", "hearts"),
      c("A", "spades")
    ], "hearts", undefined, false, "easy")).toBe(true);
  });
});

describe("deterministic bot dealer discard", () => {
  it("discards the lowest non-trump from weak cards", () => {
    expect(chooseDealerDiscard([
      c("J", "hearts"),
      c("J", "diamonds"),
      c("A", "hearts"),
      c("9", "clubs"),
      c("10", "spades"),
      c("Q", "diamonds")
    ], "hearts")).toEqual(c("9", "clubs"));
  });

  it("preserves trump and bowers", () => {
    const discard = chooseDealerDiscard([
      c("J", "spades"),
      c("J", "clubs"),
      c("A", "spades"),
      c("9", "diamonds"),
      c("10", "hearts"),
      c("Q", "clubs")
    ], "spades");

    expect(discard).toEqual(c("9", "diamonds"));
  });

  it("preserves off-suit ace over low junk when possible", () => {
    expect(chooseDealerDiscard([
      c("J", "hearts"),
      c("A", "clubs"),
      c("9", "clubs"),
      c("10", "spades"),
      c("Q", "diamonds"),
      c("K", "hearts")
    ], "hearts")).toEqual(c("9", "clubs"));
  });

  it("handles all-trump hands legally", () => {
    expect(chooseDealerDiscard([
      c("9", "hearts"),
      c("10", "hearts"),
      c("Q", "hearts"),
      c("K", "hearts"),
      c("A", "hearts"),
      c("J", "diamonds")
    ], "hearts")).toEqual(c("9", "hearts"));
  });

  it("easy discard is legal but can be less optimal than standard", () => {
    const hand = [
      c("J", "hearts"),
      c("A", "clubs"),
      c("9", "clubs"),
      c("10", "spades"),
      c("Q", "diamonds"),
      c("K", "hearts")
    ];

    expect(chooseDealerDiscard(hand, "hearts", "standard")).toEqual(c("9", "clubs"));
    expect(chooseDealerDiscard(hand, "hearts", "easy")).toEqual(c("A", "clubs"));
  });
});

describe("deterministic bot farmer's hand handling", () => {
  it("claims a qualifying redeal farmer's hand", () => {
    const state = makeFarmersHandState({
      player: 1,
      farmersHandMode: "redeal",
      hand: [c("9", "clubs"), c("10", "clubs"), c("9", "hearts"), c("10", "spades"), c("9", "diamonds")]
    });

    const action = chooseFarmersHandAction(state, 1);

    expect(action).toMatchObject({ type: "FARMERS_HAND_REDEAL", player: 1 });
  });

  it("replaces deterministic low cards for a qualifying replace-three farmer's hand", () => {
    const state = makeFarmersHandState({
      player: 1,
      farmersHandMode: "replaceThree",
      hand: [c("9", "clubs"), c("10", "clubs"), c("9", "hearts"), c("10", "spades"), c("9", "diamonds")]
    });

    expect(chooseFarmersHandAction(state, 1)).toEqual({
      type: "FARMERS_HAND_REPLACE",
      player: 1,
      cards: [c("9", "hearts"), c("10", "spades"), c("9", "diamonds")]
    });
  });

  it("does not act on farmer's hand when the bot does not qualify", () => {
    const state = makeFarmersHandState({
      player: 1,
      farmersHandMode: "redeal",
      hand: [c("A", "clubs"), c("10", "clubs"), c("9", "hearts"), c("10", "spades"), c("9", "diamonds")]
    });

    expect(chooseFarmersHandAction(state, 1)).toBeNull();
  });
});

describe("deterministic bot card play", () => {
  it("follows suit", () => {
    const state = makePlayingState({
      activePlayer: 1,
      trump: "spades",
      hands: {
        1: [c("9", "hearts"), c("A", "clubs"), c("10", "diamonds"), c("Q", "clubs"), c("K", "spades")]
      },
      trick: { leader: 0, plays: [{ player: 0, card: c("A", "hearts") }] }
    });

    expect(chooseBotAction(state, bots[0])).toEqual({ type: "PLAY_CARD", player: 1, card: c("9", "hearts") });
  });

  it("treats the left bower as trump when following suit", () => {
    const state = makePlayingState({
      activePlayer: 1,
      trump: "hearts",
      hands: {
        1: [c("J", "diamonds"), c("9", "diamonds"), c("A", "clubs"), c("10", "spades"), c("Q", "clubs")]
      },
      trick: { leader: 0, plays: [{ player: 0, card: c("A", "diamonds") }] }
    });

    expect(chooseBotAction(state, bots[0])).toEqual({ type: "PLAY_CARD", player: 1, card: c("9", "diamonds") });
  });

  it("plays low when partner is already winning", () => {
    const state = makePlayingState({
      activePlayer: 2,
      trump: "spades",
      hands: {
        2: [c("9", "hearts"), c("Q", "hearts"), c("A", "clubs"), c("10", "diamonds"), c("K", "spades")]
      },
      trick: {
        leader: 0,
        plays: [
          { player: 0, card: c("A", "hearts") },
          { player: 1, card: c("K", "hearts") }
        ]
      }
    });

    expect(chooseBotAction(state, bots[1])).toEqual({ type: "PLAY_CARD", player: 2, card: c("9", "hearts") });
  });

  it("plays the lowest winning card when an opponent is winning", () => {
    const state = makePlayingState({
      activePlayer: 2,
      trump: "spades",
      hands: {
        2: [c("9", "hearts"), c("A", "hearts"), c("A", "clubs"), c("10", "diamonds"), c("K", "spades")]
      },
      trick: { leader: 1, plays: [{ player: 1, card: c("K", "hearts") }] }
    });

    expect(chooseBotAction(state, bots[1])).toEqual({ type: "PLAY_CARD", player: 2, card: c("A", "hearts") });
  });

  it("discards the weakest card when unable to follow or win", () => {
    const state = makePlayingState({
      activePlayer: 2,
      trump: "spades",
      hands: {
        2: [c("9", "clubs"), c("10", "diamonds"), c("K", "clubs"), c("Q", "diamonds"), c("A", "clubs")]
      },
      trick: { leader: 1, plays: [{ player: 1, card: c("A", "hearts") }] }
    });

    expect(chooseBotAction(state, bots[1])).toEqual({ type: "PLAY_CARD", player: 2, card: c("9", "clubs") });
  });

  it("does not waste the right bower when lower trump wins", () => {
    const state = makePlayingState({
      activePlayer: 2,
      trump: "spades",
      hands: {
        2: [c("9", "spades"), c("J", "spades"), c("A", "clubs"), c("10", "diamonds"), c("K", "clubs")]
      },
      trick: { leader: 1, plays: [{ player: 1, card: c("A", "hearts") }] }
    });

    expect(chooseBotAction(state, bots[1])).toEqual({ type: "PLAY_CARD", player: 2, card: c("9", "spades") });
  });

  it("leads an off-suit ace when reasonable", () => {
    const state = makePlayingState({
      activePlayer: 1,
      trump: "spades",
      hands: {
        1: [c("A", "hearts"), c("9", "clubs"), c("10", "diamonds"), c("Q", "clubs"), c("9", "spades")]
      },
      trick: { leader: 1, plays: [] }
    });

    expect(chooseBotAction(state, bots[0])).toEqual({ type: "PLAY_CARD", player: 1, card: c("A", "hearts") });
  });

  it("leads trump with strong trump control", () => {
    const state = makePlayingState({
      activePlayer: 1,
      trump: "hearts",
      hands: {
        1: [c("J", "hearts"), c("J", "diamonds"), c("A", "hearts"), c("9", "clubs"), c("10", "spades")]
      },
      trick: { leader: 1, plays: [] }
    });

    expect(chooseBotAction(state, bots[0])).toEqual({ type: "PLAY_CARD", player: 1, card: c("J", "hearts") });
  });

  it("easy makes a legal weaker lead instead of attacking with an off-suit ace", () => {
    const state = makePlayingState({
      activePlayer: 1,
      trump: "spades",
      hands: {
        1: [c("A", "hearts"), c("9", "clubs"), c("10", "diamonds"), c("Q", "clubs"), c("9", "spades")]
      },
      trick: { leader: 1, plays: [] },
      botDifficulty: "easy"
    });

    expect(chooseBotAction(state, bots[0])).toEqual({ type: "PLAY_CARD", player: 1, card: c("9", "clubs") });
  });
});

describe("bot integration", () => {
  it.each(["easy", "standard", "strong"] as const)("can drive a persisted %s game through gameComplete", async (botDifficulty) => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: true, targetScore: 4, botDifficulty } });
    await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 24680 }
    });

    const loaded = await drivePersistedGame(store, game.id, 400);

    expect(loaded.state.phase).toBe("gameComplete");
    expect(loaded.state.config.botDifficulty).toBe(botDifficulty);
    expect(loaded.events.map((event) => event.sequenceNumber)).toEqual(
      loaded.events.map((_, index) => index)
    );
  }, 30_000);

  it("produces the same deterministic event sequence for identical seeded games", async () => {
    const first = await playSeededGameActions(13579);
    const second = await playSeededGameActions(13579);

    expect(second).toEqual(first);
  }, 30_000);

  it("can complete a target-score-5 game with default house rules", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: true, targetScore: 5, botDifficulty: "standard" } });
    await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 97531 }
    });

    const loaded = await drivePersistedGame(store, game.id, 500);

    expect(loaded.state.phase).toBe("gameComplete");
    expect(Math.max(...loaded.state.scores)).toBeGreaterThanOrEqual(5);
  }, 30_000);

  it("can complete a target-score-15 game when configured", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: true, targetScore: 15, botDifficulty: "standard" } });
    await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 86420 }
    });

    const loaded = await drivePersistedGame(store, game.id, 1_400);

    expect(loaded.state.phase).toBe("gameComplete");
    expect(Math.max(...loaded.state.scores)).toBeGreaterThanOrEqual(15);
  }, 60_000);
});

function makeOrderingState({
  player,
  dealer,
  upcard,
  hand
}: {
  player: PlayerIndex;
  dealer: PlayerIndex;
  upcard: Card;
  hand: Card[];
}): GameState {
  return {
    ...createInitialGameState(),
    phase: "ordering",
    dealer,
    activePlayer: player,
    upcard,
    turnedDownSuit: upcard.suit,
    hands: {
      0: [],
      1: [],
      2: [],
      3: [],
      [player]: hand
    }
  };
}

function makeFarmersHandState({
  player,
  farmersHandMode,
  hand
}: {
  player: PlayerIndex;
  farmersHandMode: "redeal" | "replaceThree";
  hand: Card[];
}): GameState {
  return {
    ...createInitialGameState({ farmersHandMode }),
    phase: "farmersHand",
    handNumber: 1,
    dealer: 0,
    activePlayer: player,
    upcard: c("A", "clubs"),
    kitty: [c("A", "clubs"), c("Q", "clubs"), c("K", "hearts"), c("A", "spades")],
    hands: {
      0: [],
      1: [],
      2: [],
      3: [],
      [player]: hand
    }
  };
}

function makeCallingState({
  player,
  dealer,
  turnedDownSuit,
  hand,
  stickDealer = false,
  roundTwoPasses = 0
}: {
  player: PlayerIndex;
  dealer: PlayerIndex;
  turnedDownSuit: Suit;
  hand: Card[];
  stickDealer?: boolean;
  roundTwoPasses?: number;
}): GameState {
  const roundOneBids: BidDecision[] = ([1, 2, 3, 0] as PlayerIndex[]).map((seat) => ({
    round: 1,
    player: seat,
    decision: "pass"
  }));
  const roundTwoBids: BidDecision[] = ([1, 2, 3] as PlayerIndex[]).slice(0, roundTwoPasses).map((seat) => ({
    round: 2,
    player: seat,
    decision: "pass"
  }));

  return {
    ...createInitialGameState({ stickDealer }),
    phase: "calling",
    dealer,
    activePlayer: player,
    turnedDownSuit,
    bids: [...roundOneBids, ...roundTwoBids],
    hands: {
      0: [],
      1: [],
      2: [],
      3: [],
      [player]: hand
    }
  };
}

function makePlayingState({
  activePlayer,
  trump,
  hands,
  trick,
  botDifficulty = "standard"
}: {
  activePlayer: PlayerIndex;
  trump: Suit;
  hands: Partial<Record<PlayerIndex, Card[]>>;
  trick: Trick;
  botDifficulty?: GameState["config"]["botDifficulty"];
}): GameState {
  return {
    ...createInitialGameState({ botDifficulty }),
    phase: "playing",
    handNumber: 1,
    dealer: 0,
    activePlayer,
    trump,
    maker: 1,
    makerTeam: 1,
    hands: {
      0: hands[0] ?? [],
      1: hands[1] ?? [],
      2: hands[2] ?? [],
      3: hands[3] ?? []
    },
    currentTrick: trick
  };
}

function chooseNextAction(state: GameState): GameAction | null {
  const bot = bots.find((candidate) => candidate.seat === state.activePlayer);
  if (bot) {
    return chooseBotAction(state, bot);
  }

  const legal = legalActionsForPlayer(state, 0);
  if (state.phase === "farmersHand") {
    return legal.canClaimFarmersHand && state.config.farmersHandMode === "redeal"
      ? { type: "FARMERS_HAND_REDEAL", player: 0, seed: 70000 + state.moveLog.length }
      : { type: "FARMERS_HAND_DECLINE", player: 0 };
  }

  if (state.phase === "ordering") {
    return legal.canOrderUp ? { type: "PASS", player: 0 } : null;
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
      ? { type: "NEXT_HAND", seed: 30000 + loaded.state.handNumber } as GameAction
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

async function playSeededGameActions(seed: number): Promise<GameAction[]> {
  const store = await createStore();
  const game = await store.createGame({ config: { stickDealer: true, targetScore: 4 } });
  await store.appendMove({
    gameId: game.id,
    expectedSequence: 0,
    action: { type: "START_HAND", seed }
  });

  const loaded = await drivePersistedGame(store, game.id, 300);
  return loaded.events.map((event) => event.payload);
}

async function createStore(): Promise<LocalEventStore> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "euchre-bot-store-"));
  testDirs.push(dir);
  return new LocalEventStore(path.join(dir, "events.json"));
}
