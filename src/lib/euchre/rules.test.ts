import { describe, expect, it } from "vitest";
import { effectiveSuit, isLeftBower, isRightBower } from "./cards";
import { nextPlayer } from "./deck";
import { createInitialGameState, dispatchAction, replayMoveLog } from "./engine";
import {
  canPlayCard,
  determineTrickWinner,
  farmersHandReplaceableCards,
  isFarmersHandQualifier,
  legalActionsForPlayer,
  playableCards,
  scoreHand
} from "./rules";
import type { Card, GameState, PlayerIndex, Trick } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("bower handling", () => {
  it("treats the right bower as trump", () => {
    expect(isRightBower(c("J", "hearts"), "hearts")).toBe(true);
    expect(effectiveSuit(c("J", "hearts"), "hearts")).toBe("hearts");
  });

  it("treats the left bower as the trump suit", () => {
    const left = c("J", "diamonds");

    expect(isLeftBower(left, "hearts")).toBe(true);
    expect(effectiveSuit(left, "hearts")).toBe("hearts");
  });
});

describe("follow suit validation", () => {
  it("requires a player to follow the effective led suit when able", () => {
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c("9", "clubs") }]
    };
    const hand = [c("A", "clubs"), c("A", "hearts")];

    expect(canPlayCard(hand, c("A", "hearts"), trick, "spades")).toBe(false);
    expect(canPlayCard(hand, c("A", "clubs"), trick, "spades")).toBe(true);
  });

  it("uses left bower suit for follow-suit checks", () => {
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c("J", "diamonds") }]
    };
    const hand = [c("9", "hearts"), c("A", "clubs")];

    expect(playableCards(hand, trick, "hearts")).toEqual([c("9", "hearts")]);
  });

  it("does not let the left bower follow its printed suit", () => {
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c("A", "diamonds") }]
    };
    const hand = [c("J", "diamonds"), c("9", "clubs")];

    expect(canPlayCard(hand, c("9", "clubs"), trick, "hearts")).toBe(true);
  });
});

describe("trick winner logic", () => {
  it("ranks right bower above left bower and other trump cards", () => {
    const trick: Trick = {
      leader: 0,
      plays: [
        { player: 0, card: c("A", "hearts") },
        { player: 1, card: c("J", "diamonds") },
        { player: 2, card: c("J", "hearts") },
        { player: 3, card: c("9", "hearts") }
      ]
    };

    expect(determineTrickWinner(trick, "hearts")).toBe(2);
  });

  it("lets trump beat the led suit", () => {
    const trick: Trick = {
      leader: 0,
      plays: [
        { player: 0, card: c("A", "clubs") },
        { player: 1, card: c("9", "clubs") },
        { player: 2, card: c("9", "spades") },
        { player: 3, card: c("K", "clubs") }
      ]
    };

    expect(determineTrickWinner(trick, "spades")).toBe(2);
  });

  it("determines a winner for a three-card lone trick", () => {
    const trick: Trick = {
      leader: 0,
      plays: [
        { player: 0, card: c("A", "hearts") },
        { player: 1, card: c("9", "hearts") },
        { player: 3, card: c("J", "diamonds") }
      ]
    };

    expect(determineTrickWinner(trick, "hearts")).toBe(3);
  });
});

describe("scoring", () => {
  it("awards makers one point for three or four tricks", () => {
    expect(
      scoreHand({
        makerTeam: 0,
        maker: 0,
        trump: "clubs",
        tricksWon: [3, 2]
      }).pointsAwarded
    ).toEqual([1, 0]);
  });

  it("awards makers two points for a non-lone march", () => {
    expect(
      scoreHand({
        makerTeam: 1,
        maker: 1,
        trump: "clubs",
        tricksWon: [0, 5]
      }).pointsAwarded
    ).toEqual([0, 2]);
  });

  it("awards four points for a lone march", () => {
    expect(
      scoreHand({
        makerTeam: 1,
        maker: 1,
        trump: "clubs",
        tricksWon: [0, 5],
        lonePlayer: 1
      }).pointsAwarded
    ).toEqual([0, 4]);
  });

  it("awards one point for a lone hand that wins three or four tricks", () => {
    expect(
      scoreHand({
        makerTeam: 0,
        maker: 0,
        trump: "clubs",
        tricksWon: [4, 1],
        lonePlayer: 0
      }).pointsAwarded
    ).toEqual([1, 0]);
  });

  it("awards defenders two points for a euchre", () => {
    expect(
      scoreHand({
        makerTeam: 0,
        maker: 0,
        trump: "clubs",
        tricksWon: [2, 3]
      }).pointsAwarded
    ).toEqual([0, 2]);
  });
});

describe("state machine", () => {
  it("defaults new house-rule config fields for older games", () => {
    const state = createInitialGameState({ stickDealer: true, targetScore: 15 });

    expect(state.config).toMatchObject({
      stickDealer: true,
      targetScore: 15,
      botDifficulty: "standard",
      dealerSelection: "default",
      farmersHandMode: "off",
      lonerMode: "aloneOnly"
    });
  });

  it("uses configured initial dealer selection", () => {
    expect(createInitialGameState({ dealerSelection: "human" }).dealer).toBe(0);
    expect(createInitialGameState({ dealerSelection: "seat2" }).dealer).toBe(2);
  });

  it("repeats the same first deal for the same seed and config", () => {
    const config = { stickDealer: true, targetScore: 10, dealerSelection: "seat2" as const };
    const first = dispatchAction(createInitialGameState(config), { type: "START_HAND", seed: 123456 });
    const second = dispatchAction(createInitialGameState(config), { type: "START_HAND", seed: 123456 });
    const different = dispatchAction(createInitialGameState(config), { type: "START_HAND", seed: 123457 });

    expect(second.hands).toEqual(first.hands);
    expect(second.kitty).toEqual(first.kitty);
    expect(different.hands).not.toEqual(first.hands);
  });

  it("deals a 24-card Euchre hand with an upcard", () => {
    const state = dispatchAction(createInitialGameState(), { type: "START_HAND", seed: 42 });

    expect(state.phase).toBe("ordering");
    expect(Object.values(state.hands).flat()).toHaveLength(20);
    expect(state.kitty).toHaveLength(4);
    expect(state.upcard).toBeDefined();
    expect(state.activePlayer).toBe(1);
  });

  it("moves from ordering to dealer discard when trump is ordered up", () => {
    let state = dispatchAction(createInitialGameState(), { type: "START_HAND", seed: 42 });
    state = dispatchAction(state, { type: "ORDER_UP", player: 1 });

    expect(state.phase).toBe("discarding");
    expect(state.trump).toBe(state.upcard?.suit);
    expect(state.hands[state.dealer]).toHaveLength(6);
    expect(state.activePlayer).toBe(state.dealer);
  });

  it("lets dealer discard and starts play left of dealer", () => {
    let state = dispatchAction(createInitialGameState(), { type: "START_HAND", seed: 42 });
    state = dispatchAction(state, { type: "ORDER_UP", player: 1 });
    const discard = state.hands[state.dealer][0];
    state = dispatchAction(state, { type: "DISCARD", player: state.dealer, card: discard });

    expect(state.phase).toBe("playing");
    expect(state.hands[state.dealer]).toHaveLength(5);
    expect(state.currentTrick?.leader).toBe(1);
  });

  it("enforces stick the dealer in the second round", () => {
    let state = dispatchAction(createInitialGameState({ stickDealer: true }), { type: "START_HAND", seed: 10 });

    for (const player of [1, 2, 3, 0] as PlayerIndex[]) {
      state = dispatchAction(state, { type: "PASS", player });
    }

    for (const player of [1, 2, 3] as PlayerIndex[]) {
      state = dispatchAction(state, { type: "PASS", player });
    }

    expect(legalActionsForPlayer(state, 0).canPass).toBe(false);
    expect(() => dispatchAction(state, { type: "PASS", player: 0 })).toThrow(/Stick the dealer/);
  });

  it("stores all actions as replayable move events", () => {
    let state = dispatchAction(createInitialGameState(), { type: "START_HAND", seed: 42 });
    state = dispatchAction(state, { type: "ORDER_UP", player: 1, alone: true });
    state = dispatchAction(state, { type: "DISCARD", player: 0, card: state.hands[0][0] });

    const replayed = replayMoveLog(state.moveLog);

    expect(replayed.phase).toBe(state.phase);
    expect(replayed.trump).toBe(state.trump);
    expect(replayed.lonePlayer).toBe(1);
    expect(replayed.hands).toEqual(state.hands);
  });

  it("scores a completed hand after five tricks", () => {
    const state = makePlayingState([
      [c("A", "clubs"), c("K", "clubs"), c("Q", "clubs"), c("10", "clubs"), c("9", "clubs")],
      [c("9", "diamonds"), c("10", "diamonds"), c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")],
      [c("9", "hearts"), c("10", "hearts"), c("Q", "hearts"), c("K", "hearts"), c("A", "hearts")],
      [c("9", "spades"), c("10", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")]
    ]);

    const finished = [
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2, 3]
    ].reduce((current, trickPlayers) => {
      return trickPlayers.reduce((inner, player) => {
        const card = inner.hands[player as PlayerIndex][0];
        return dispatchAction(inner, { type: "PLAY_CARD", player: player as PlayerIndex, card });
      }, current);
    }, state);

    expect(finished.phase).toBe("handComplete");
    expect(finished.handResult?.pointsAwarded).toEqual([2, 0]);
    expect(finished.scores).toEqual([2, 0]);
  });

  it("starts the next trick with the previous trick winner as leader", () => {
    let state = makePlayingState([
      [c("A", "hearts"), c("9", "clubs"), c("10", "clubs"), c("Q", "clubs"), c("K", "clubs")],
      [c("K", "hearts"), c("9", "diamonds"), c("10", "diamonds"), c("Q", "diamonds"), c("K", "diamonds")],
      [c("J", "clubs"), c("9", "spades"), c("10", "spades"), c("Q", "spades"), c("K", "spades")],
      [c("Q", "hearts"), c("10", "hearts"), c("9", "hearts"), c("A", "diamonds"), c("A", "spades")]
    ]);

    state = dispatchAction(state, { type: "PLAY_CARD", player: 0, card: c("A", "hearts") });
    state = dispatchAction(state, { type: "PLAY_CARD", player: 1, card: c("K", "hearts") });
    state = dispatchAction(state, { type: "PLAY_CARD", player: 2, card: c("J", "clubs") });
    state = dispatchAction(state, { type: "PLAY_CARD", player: 3, card: c("Q", "hearts") });

    expect(state.completedTricks[0].winner).toBe(2);
    expect(state.currentTrick?.leader).toBe(2);
    expect(state.activePlayer).toBe(2);
  });

  it("sits out the caller's partner during a lone hand", () => {
    let state: GameState = {
      ...makePlayingState([
        [c("A", "clubs"), c("K", "clubs"), c("Q", "clubs"), c("10", "clubs"), c("9", "clubs")],
        [c("9", "diamonds"), c("10", "diamonds"), c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")],
        [c("9", "hearts"), c("10", "hearts"), c("Q", "hearts"), c("K", "hearts"), c("A", "hearts")],
        [c("9", "spades"), c("10", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")]
      ]),
      lonePlayer: 0
    };

    while (state.phase === "playing") {
      const player = state.activePlayer;
      expect(player).not.toBe(2);
      const card = legalActionsForPlayer(state, player).playableCards[0];
      state = dispatchAction(state, { type: "PLAY_CARD", player, card });
    }

    expect(state.phase).toBe("handComplete");
    expect(state.handResult?.lone).toBe(true);
    expect(state.hands[2]).toHaveLength(5);
    expect(state.completedTricks).toHaveLength(5);
    expect(state.completedTricks.every((trick) => trick.plays.length === 3)).toBe(true);
    expect(state.completedTricks.flatMap((trick) => trick.plays).some((play) => play.player === 2)).toBe(false);
    expect(state.tricksWon[0] + state.tricksWon[1]).toBe(5);
  });

  it("completes the game at the selected target score", () => {
    const state = makePlayingState([
      [c("A", "clubs"), c("K", "clubs"), c("Q", "clubs"), c("10", "clubs"), c("9", "clubs")],
      [c("9", "diamonds"), c("10", "diamonds"), c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")],
      [c("9", "hearts"), c("10", "hearts"), c("Q", "hearts"), c("K", "hearts"), c("A", "hearts")],
      [c("9", "spades"), c("10", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")]
    ], { targetScore: 2 });

    const finished = playAllCardsInSeatOrder(state);

    expect(finished.phase).toBe("gameComplete");
    expect(finished.scores).toEqual([2, 0]);
  });
});

describe("farmer's hand rules", () => {
  it("identifies the conservative all-low qualifier", () => {
    const qualifying = [c("9", "clubs"), c("10", "clubs"), c("9", "hearts"), c("10", "spades"), c("9", "diamonds")];
    const notQualifying = [c("9", "clubs"), c("10", "clubs"), c("Q", "hearts"), c("10", "spades"), c("9", "diamonds")];

    expect(isFarmersHandQualifier(qualifying)).toBe(true);
    expect(isFarmersHandQualifier(notQualifying)).toBe(false);
    expect(farmersHandReplaceableCards(qualifying)).toEqual(qualifying);
  });

  it("keeps current bidding flow when farmer's hand is off", () => {
    const state = dispatchAction(createInitialGameState({ farmersHandMode: "off" }), { type: "START_HAND", seed: 42 });

    expect(state.phase).toBe("ordering");
  });

  it("skips farmer's hand when no player qualifies", () => {
    const seed = findSeedWithoutFarmersHand("redeal");
    const state = dispatchAction(createInitialGameState({ farmersHandMode: "redeal" }), { type: "START_HAND", seed });

    expect(state.phase).toBe("ordering");
    expect(state.activePlayer).toBe(nextPlayer(state.dealer));
  });

  it("offers farmer's hand during the active player's normal bidding turn", () => {
    const seed = findSeedWithFarmersHand("redeal");
    const state = dispatchAction(createInitialGameState({ farmersHandMode: "redeal" }), { type: "START_HAND", seed });
    const legal = legalActionsForPlayer(state, state.activePlayer);

    expect(state.phase).toBe("ordering");
    expect(isFarmersHandQualifier(state.hands[state.activePlayer])).toBe(true);
    expect(legal.canClaimFarmersHand).toBe(true);
    expect(legal.canDeclineFarmersHand).toBe(false);
    expect(state.activePlayer).toBe(nextPlayer(state.dealer));
  });

  it("redeals a qualifying farmer's hand deterministically and replays from events", () => {
    const seed = findSeedWithFarmersHand("redeal");
    let state = dispatchAction(createInitialGameState({ farmersHandMode: "redeal" }), { type: "START_HAND", seed });
    const claimingPlayer = state.activePlayer;

    expect(isFarmersHandQualifier(state.hands[claimingPlayer])).toBe(true);
    const redealSeed = findSeedWithFarmersHand("redeal");
    state = dispatchAction(state, { type: "FARMERS_HAND_REDEAL", player: claimingPlayer, seed: redealSeed });

    const replayed = replayMoveLog(state.moveLog, { farmersHandMode: "redeal" });

    expect(state.handNumber).toBe(1);
    expect(state.dealer).toBe(0);
    expect(state.phase).toBe("ordering");
    expect(state.activePlayer).toBe(nextPlayer(state.dealer));
    expect(replayed.hands).toEqual(state.hands);
    expect(replayed.kitty).toEqual(state.kitty);
  });

  it("replaces up to three qualifying low cards with kitty cards and replays from events", () => {
    const seed = findSeedWithFarmersHand("replaceThree");
    let state = dispatchAction(createInitialGameState({ farmersHandMode: "replaceThree" }), { type: "START_HAND", seed });
    const claimingPlayer = state.activePlayer;
    const cards = farmersHandReplaceableCards(state.hands[claimingPlayer]).slice(0, 3);

    state = dispatchAction(state, { type: "FARMERS_HAND_REPLACE", player: claimingPlayer, cards });

    const replayed = replayMoveLog(state.moveLog, { farmersHandMode: "replaceThree" });

    expect(state.phase).toBe("ordering");
    expect(state.hands[claimingPlayer]).toHaveLength(5);
    expect(state.kitty.slice(1, 1 + cards.length)).toEqual(cards);
    expect(replayed.hands).toEqual(state.hands);
    expect(replayed.kitty).toEqual(state.kitty);
  });

  it("rejects zero, more than three, duplicate, and non-eligible replacement payloads", () => {
    const seed = findSeedWithFarmersHand("replaceThree");
    const state = dispatchAction(createInitialGameState({ farmersHandMode: "replaceThree" }), { type: "START_HAND", seed });
    const player = state.activePlayer;
    const cards = farmersHandReplaceableCards(state.hands[player]);

    expect(() => dispatchAction(state, { type: "FARMERS_HAND_REPLACE", player, cards: [] })).toThrow(/one to three/);
    expect(() => dispatchAction(state, { type: "FARMERS_HAND_REPLACE", player, cards: [cards[0], cards[0]] })).toThrow(/unique/);
    expect(() => dispatchAction(state, { type: "FARMERS_HAND_REPLACE", player, cards: [c("A", "clubs")] })).toThrow(/must be in the player's hand/);
    expect(() => dispatchAction(state, { type: "FARMERS_HAND_REPLACE", player, cards: [...cards, c("9", "clubs")] })).toThrow(/one to three/);
  });
});

function makePlayingState(
  hands: [Card[], Card[], Card[], Card[]],
  config: Parameters<typeof createInitialGameState>[0] = {}
): GameState {
  return {
    ...createInitialGameState(config),
    phase: "playing",
    handNumber: 1,
    dealer: 3,
    activePlayer: 0,
    trump: "clubs",
    maker: 0,
    makerTeam: 0,
    hands: {
      0: hands[0],
      1: hands[1],
      2: hands[2],
      3: hands[3]
    },
    currentTrick: {
      leader: 0,
      plays: []
    }
  };
}

function playAllCardsInSeatOrder(state: GameState): GameState {
  return [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3]
  ].reduce((current, trickPlayers) => {
    return trickPlayers.reduce((inner, player) => {
      const card = inner.hands[player as PlayerIndex][0];
      return dispatchAction(inner, { type: "PLAY_CARD", player: player as PlayerIndex, card });
    }, current);
  }, state);
}

function findSeedWithFarmersHand(farmersHandMode: "redeal" | "replaceThree"): number {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const state = dispatchAction(createInitialGameState({ farmersHandMode }), { type: "START_HAND", seed });
    if (isFarmersHandQualifier(state.hands[state.activePlayer])) {
      return seed;
    }
  }

  throw new Error("Unable to find deterministic farmer's hand fixture seed");
}

function findSeedWithoutFarmersHand(farmersHandMode: "redeal" | "replaceThree"): number {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const state = dispatchAction(createInitialGameState({ farmersHandMode }), { type: "START_HAND", seed });
    if (state.phase === "ordering" && ([0, 1, 2, 3] as PlayerIndex[]).every((player) => !isFarmersHandQualifier(state.hands[player]))) {
      return seed;
    }
  }

  throw new Error("Unable to find deterministic non-farmer's-hand fixture seed");
}
