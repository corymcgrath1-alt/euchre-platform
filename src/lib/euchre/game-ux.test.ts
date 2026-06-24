import { describe, expect, it } from "vitest";
import { createMoveEvent } from "./engine";
import {
  buildBiddingExplanation,
  buildCardPlayExplanation,
  buildFarmersHandExplanation,
  buildHandResultExplanation,
  buildTurnPrompt,
  formatRecentBotAction,
  getAvailableGameControls,
  getRecentBotActions
} from "./game-ux";
import type { Card, GameState, MoveEvent, PlayerIndex } from "./types";
import { createInitialGameState } from "./engine";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("turn prompts", () => {
  it("prompts the human during ordering", () => {
    const state = makeState({
      phase: "ordering",
      activePlayer: 0,
      upcard: c("J", "hearts")
    });

    expect(buildTurnPrompt(state, 0)).toMatchObject({
      title: "Your order-up decision",
      humanTurn: true
    });
    expect(buildTurnPrompt(state, 0).body).toContain("JH");
  });

  it("prompts farmer's hand phase", () => {
    const state = makeState({ phase: "farmersHand", activePlayer: 0 });

    expect(buildTurnPrompt(state, 0).body).toContain("eligible low cards");
  });

  it("prompts dealer discard", () => {
    const state = makeState({ phase: "discarding", activePlayer: 0, dealer: 0 });

    expect(buildTurnPrompt(state, 0).body).toContain("discard back to five");
  });

  it("prompts trick play and distinguishes bot turn", () => {
    const state = makeState({ phase: "playing", activePlayer: 1 });

    expect(buildTurnPrompt(state, 0)).toMatchObject({
      title: "West is playing",
      humanTurn: false
    });
  });

  it("prompts hand complete and game complete", () => {
    const handComplete = makeState({ phase: "handComplete", scores: [1, 0] });
    const gameComplete = makeState({ phase: "gameComplete", scores: [10, 7] });

    expect(buildTurnPrompt(handComplete, 0).title).toBe("Hand complete");
    expect(buildTurnPrompt(gameComplete, 0).body).toContain("Team 0 wins 10-7");
  });
});

describe("legal action explanations", () => {
  it("returns lead explanation", () => {
    const state = makePlayingState({ plays: [] });

    expect(buildCardPlayExplanation(state, 0).primary).toBe("You are leading this trick.");
  });

  it("returns follow-suit explanation", () => {
    const state = makePlayingState({
      plays: [{ player: 1, card: c("A", "hearts") }],
      hand: [c("9", "hearts"), c("A", "clubs")]
    });

    expect(buildCardPlayExplanation(state, 0).primary).toContain("must follow hearts");
  });

  it("returns void/free-play explanation", () => {
    const state = makePlayingState({
      plays: [{ player: 1, card: c("A", "hearts") }],
      hand: [c("9", "clubs"), c("A", "spades")]
    });

    expect(buildCardPlayExplanation(state, 0).primary).toContain("void in the led suit");
  });

  it("returns bidding explanation", () => {
    const state = makeState({ phase: "ordering", upcard: c("9", "spades"), dealer: 2 });

    expect(buildBiddingExplanation(state, 0).details).toContain("Dealer: North (your partner).");
    expect(buildBiddingExplanation(state, 0).details).toContain("Upcard suit: spades.");
  });

  it("returns farmer's hand explanation safely", () => {
    const state = makeState({
      phase: "farmersHand",
      config: { farmersHandMode: "replaceThree" },
      hands: { 0: [c("9", "clubs"), c("A", "hearts")] }
    });

    expect(buildFarmersHandExplanation(state, 0).details).toContain("Eligible low cards in your hand: 1.");
  });
});

describe("hand result explanations", () => {
  it("explains makers scoring one point", () => {
    expect(buildHandResultExplanation(makeHandResult({ makerTricks: 4, pointsAwarded: [1, 0] }))).toContain("Makers made 4 tricks");
  });

  it("explains makers scoring two points", () => {
    expect(buildHandResultExplanation(makeHandResult({ makerTricks: 5, pointsAwarded: [2, 0] }))).toContain("swept all 5 tricks");
  });

  it("explains defenders euchre", () => {
    expect(buildHandResultExplanation(makeHandResult({ makerTricks: 2, defenderTricks: 3, pointsAwarded: [0, 2], euchred: true }))).toContain("Defenders euchred");
  });

  it("explains successful loner", () => {
    expect(buildHandResultExplanation(makeHandResult({ makerTricks: 5, pointsAwarded: [4, 0], lone: true, loneSucceeded: true }))).toContain("Lone hand succeeded");
  });

  it("handles missing detail safely", () => {
    expect(buildHandResultExplanation({})).toContain("unavailable");
  });
});

describe("game controls and bot action summaries", () => {
  it("allows next hand only after hand complete", () => {
    expect(getAvailableGameControls(makeState({ phase: "handComplete" })).canStartNextHand).toBe(true);
    expect(getAvailableGameControls(makeState({ phase: "gameComplete" })).canStartNextHand).toBe(false);
    expect(getAvailableGameControls(makeState({ phase: "gameComplete" })).canReviewGame).toBe(true);
  });

  it("formats recent bot actions", () => {
    expect(formatRecentBotAction(move({ type: "PASS", player: 1 }))).toBe("West passed.");
    expect(formatRecentBotAction(move({ type: "ORDER_UP", player: 2 }))).toBe("North ordered up.");
    expect(formatRecentBotAction(move({ type: "CALL_TRUMP", player: 3, suit: "spades" }))).toBe("East called spades.");
    expect(formatRecentBotAction(move({ type: "DISCARD", player: 1, card: c("10", "diamonds") }))).toBe("West discarded 10D.");
    expect(formatRecentBotAction(move({ type: "PLAY_CARD", player: 1, card: c("9", "clubs") }))).toBe("West played 9C.");
    expect(formatRecentBotAction(move({ type: "FARMERS_HAND_DECLINE", player: 1 }))).toBe("West declined Farmer's Hand.");
  });

  it("filters compact recent bot action list from move log", () => {
    const events = [
      move({ type: "PASS", player: 0 }),
      move({ type: "PASS", player: 1 }),
      move({ type: "PLAY_CARD", player: 2, card: c("A", "clubs") })
    ];

    expect(getRecentBotActions(events, 2)).toEqual(["West passed.", "North played AC."]);
  });
});

type StateOverrides = Omit<Partial<GameState>, "config" | "hands"> & {
  config?: Partial<GameState["config"]>;
  hands?: Partial<GameState["hands"]>;
};

function makeState(overrides: StateOverrides = {}): GameState {
  const base = createInitialGameState(overrides.config);
  return {
    ...base,
    ...overrides,
    config: { ...base.config, ...overrides.config },
    hands: {
      ...base.hands,
      ...overrides.hands
    }
  };
}

function makePlayingState({
  plays,
  hand = [c("A", "clubs"), c("9", "hearts")]
}: {
  plays: Array<{ player: PlayerIndex; card: Card }>;
  hand?: Card[];
}): GameState {
  return makeState({
    phase: "playing",
    activePlayer: 0,
    trump: "spades",
    hands: { 0: hand },
    currentTrick: {
      leader: plays[0]?.player ?? 0,
      plays
    }
  });
}

function makeHandResult(overrides: Partial<Parameters<typeof buildHandResultExplanation>[0]> = {}) {
  return {
    maker: 0 as PlayerIndex,
    makerTeam: 0 as const,
    defendingTeam: 1 as const,
    trumpSuit: "hearts" as const,
    makerTricks: 4,
    defenderTricks: 1,
    pointsAwarded: [1, 0] as [number, number],
    teamScoreAfterHand: [5, 3] as [number, number],
    ...overrides
  };
}

function move(action: MoveEvent["action"]): MoveEvent {
  return createMoveEvent(action, 0);
}
