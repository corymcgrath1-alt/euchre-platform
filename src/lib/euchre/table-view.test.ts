import { describe, expect, it } from "vitest";
import { createInitialGameState, createMoveEvent } from "./engine";
import {
  buildCurrentTrickView,
  buildEuchreScoreCardViews,
  buildFiveCardScoreView,
  buildHumanHandView,
  buildTableSeatViews,
  buildTableStatusView
} from "./table-view";
import type { Card, GameState, MoveEvent } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("table seat view models", () => {
  it("labels seats around the table and marks dealer, actor, and caller roles", () => {
    const state = makeState({
      phase: "playing",
      dealer: 2,
      activePlayer: 1,
      maker: 3,
      makerTeam: 1,
      moveLog: [
        move({ type: "PASS", player: 1 }),
        move({ type: "CALL_TRUMP", player: 3, suit: "spades" })
      ]
    });

    const seats = buildTableSeatViews(state);

    expect(seats.map((seat) => [seat.seat, seat.name, seat.position])).toEqual([
      [0, "South", "south"],
      [1, "West", "west"],
      [2, "North", "north"],
      [3, "East", "east"]
    ]);
    expect(seats.find((seat) => seat.seat === 2)).toMatchObject({ isDealer: true });
    expect(seats.find((seat) => seat.seat === 1)).toMatchObject({ isActive: true, recentAction: "West passed." });
    expect(seats.find((seat) => seat.seat === 3)).toMatchObject({ isCaller: true, isMaker: true });
    expect(seats.find((seat) => seat.seat === 1)).toMatchObject({ isPartnerOfCaller: true, isMaker: true });
  });
});

describe("table status view models", () => {
  it("summarizes score, phase, dealer, trump, and trick score", () => {
    const state = makeState({
      phase: "ordering",
      handNumber: 2,
      scores: [4, 3],
      dealer: 1,
      activePlayer: 2,
      upcard: c("J", "hearts"),
      trump: "hearts",
      makerTeam: 0,
      tricksWon: [2, 1]
    });

    expect(buildTableStatusView(state)).toMatchObject({
      handLabel: "Hand 2",
      scoreLabel: "Team 0 4 - 3 Team 1",
      scores: [4, 3],
      phaseLabel: "Ordering",
      dealerLabel: "West",
      activePlayerLabel: "North",
      trumpLabel: "hearts",
      upcardLabel: "JH",
      makersLabel: "Team 0",
      trickScoreLabel: "2 - 1"
    });
  });
});

describe("euchre score card view models", () => {
  it("maps scores onto two five-card score cards per team", () => {
    expect(buildEuchreScoreCardViews([0, 7])).toEqual([
      {
        team: 0,
        score: 0,
        label: "Team 0",
        cards: [
          { cardNumber: 1, pointsVisible: 0 },
          { cardNumber: 2, pointsVisible: 0 }
        ]
      },
      {
        team: 1,
        score: 7,
        label: "Team 1",
        cards: [
          { cardNumber: 1, pointsVisible: 5 },
          { cardNumber: 2, pointsVisible: 2 }
        ]
      }
    ]);
  });

  it("caps the authentic score-card display at ten points", () => {
    expect(buildEuchreScoreCardViews([12, 10]).map((team) => team.cards.map((card) => card.pointsVisible))).toEqual([
      [5, 5],
      [5, 5]
    ]);
  });
});

describe("five-card score view models", () => {
  it.each([
    [0, [0, 0]],
    [1, [1, 0]],
    [5, [5, 0]],
    [6, [5, 1]],
    [10, [5, 5]]
  ] as const)("maps score %i onto two five cards", (score, visiblePips) => {
    expect(buildFiveCardScoreView(score, "red").cards.map((card) => card.visiblePips)).toEqual(visiblePips);
  });

  it("keeps red score cards as hearts and diamonds", () => {
    expect(buildFiveCardScoreView(7, "red")).toMatchObject({
      teamColor: "red",
      score: 7,
      clampedScore: 7,
      accessibleLabel: "North/South team score: 7",
      cards: [
        { suit: "hearts", cardLabel: "5H", color: "red", faceUp: true, visiblePips: 5, isBaseFive: true, state: "complete" },
        { suit: "diamonds", cardLabel: "5D", color: "red", faceUp: true, visiblePips: 2, isBaseFive: false, state: "partial" }
      ]
    });
  });

  it("keeps black score cards as spades and clubs", () => {
    expect(buildFiveCardScoreView(4, "black")).toMatchObject({
      teamColor: "black",
      score: 4,
      cards: [
        { suit: "spades", cardLabel: "5S", color: "black", faceUp: true, visiblePips: 4, isBaseFive: false, state: "partial" },
        { suit: "clubs", cardLabel: "5C", color: "black", faceUp: false, visiblePips: 0, isBaseFive: false, state: "unused" }
      ]
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("maps every red score state %i to physical five-card pips", (score) => {
    const view = buildFiveCardScoreView(score, "red");
    const expected: [number, number] = [Math.min(score, 5), Math.max(0, score - 5)] as [number, number];

    expect(view.cards.map((card) => card.visiblePips)).toEqual(expected);
    expect(view.cards.map((card) => card.cardLabel)).toEqual(["5H", "5D"]);
    expect(view.cards[0].faceUp).toBe(score > 0);
    expect(view.cards[1].faceUp).toBe(score > 5);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("maps every black score state %i to physical five-card pips", (score) => {
    const view = buildFiveCardScoreView(score, "black");
    const expected: [number, number] = [Math.min(score, 5), Math.max(0, score - 5)] as [number, number];

    expect(view.cards.map((card) => card.visiblePips)).toEqual(expected);
    expect(view.cards.map((card) => card.cardLabel)).toEqual(["5S", "5C"]);
  });

  it("clamps visible pips while preserving the source score", () => {
    expect(buildFiveCardScoreView(-2, "black").cards.map((card) => card.visiblePips)).toEqual([0, 0]);
    expect(buildFiveCardScoreView(12, "red").cards.map((card) => card.visiblePips)).toEqual([5, 5]);
    expect(buildFiveCardScoreView(12, "red").score).toBe(12);
  });
});

describe("current trick view models", () => {
  it("keeps cards in played order and identifies led suit, unplayed seats, and current winner", () => {
    const state = makeState({
      phase: "playing",
      trump: "spades",
      completedTricks: [
        { leader: 0, plays: [], winner: 2 }
      ],
      currentTrick: {
        leader: 1,
        plays: [
          { player: 1, card: c("A", "hearts") },
          { player: 2, card: c("J", "clubs") },
          { player: 3, card: c("K", "hearts") }
        ]
      }
    });

    const view = buildCurrentTrickView(state);

    expect(view).toMatchObject({
      trickNumber: 2,
      leaderSeat: 1,
      leaderLabel: "West",
      ledSuitLabel: "hearts",
      trumpLabel: "spades",
      currentWinnerSeat: 2,
      currentWinnerLabel: "North",
      winningCardLabel: "JC",
      latestCompletedWinnerLabel: "North"
    });
    expect(view.plays.map((play) => play.cardLabel)).toEqual(["AH", "JC", "KH"]);
    expect(view.plays.find((play) => play.seat === 2)).toMatchObject({ isTrump: true, isWinningCard: true });
    expect(view.unplayedSeats).toEqual([0]);
  });

  it("can hold the latest completed trick with all four cards and the winner visible", () => {
    const state = makeState({
      phase: "playing",
      trump: "spades",
      completedTricks: [
        {
          leader: 1,
          plays: [
            { player: 1, card: c("A", "hearts") },
            { player: 2, card: c("J", "clubs") },
            { player: 3, card: c("K", "hearts") },
            { player: 0, card: c("9", "hearts") }
          ],
          winner: 2
        }
      ],
      currentTrick: {
        leader: 2,
        plays: []
      }
    });

    const view = buildCurrentTrickView(state, { showLatestCompleted: true });

    expect(view).toMatchObject({
      trickNumber: 1,
      isShowingCompletedTrick: true,
      leaderSeat: 1,
      leaderLabel: "West",
      nextLeaderSeat: 2,
      nextLeaderLabel: "North",
      ledSuitLabel: "hearts",
      currentWinnerSeat: 2,
      currentWinnerLabel: "North",
      winningCardLabel: "JC",
      latestCompletedWinnerLabel: "North"
    });
    expect(view.plays.map((play) => play.cardLabel)).toEqual(["AH", "JC", "KH", "9H"]);
    expect(view.plays.find((play) => play.seat === 2)).toMatchObject({ isWinningCard: true });
    expect(view.unplayedSeats).toEqual([]);
  });
});

describe("human hand view models", () => {
  it("marks legal follow-suit cards during play", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "spades",
      hands: {
        0: [c("9", "hearts"), c("A", "clubs"), c("J", "clubs")]
      },
      currentTrick: {
        leader: 1,
        plays: [{ player: 1, card: c("A", "hearts") }]
      }
    });

    const view = buildHumanHandView(state);

    expect(view.helperText).toContain("must follow hearts");
    expect(view.cards.map((card) => [card.label, card.legal])).toEqual([
      ["JC", false],
      ["9H", true],
      ["AC", false]
    ]);
  });

  it("sorts the visible human hand by effective suit and strongest cards first", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "spades",
      hands: {
        0: [c("9", "hearts"), c("A", "clubs"), c("J", "clubs"), c("A", "spades"), c("10", "hearts")]
      },
      currentTrick: {
        leader: 0,
        plays: []
      }
    });

    const view = buildHumanHandView(state);

    expect(view.cards.map((card) => card.label)).toEqual(["JC", "AS", "10H", "9H", "AC"]);
  });

  it("marks every card as selectable when the human must discard", () => {
    const state = makeState({
      phase: "discarding",
      activePlayer: 0,
      dealer: 0,
      hands: {
        0: [c("9", "hearts"), c("A", "clubs"), c("J", "clubs"), c("K", "spades"), c("Q", "diamonds"), c("10", "clubs")]
      }
    });

    const view = buildHumanHandView(state);

    expect(view.mustDiscard).toBe(true);
    expect(view.cards.every((card) => card.legal)).toBe(true);
    expect(view.actionLabel).toBe("Choose a discard");
  });

  it("marks Farmer's Hand replacement cards selectable from the table hand", () => {
    const state = makeState({
      phase: "farmersHand",
      activePlayer: 0,
      config: { farmersHandMode: "replaceThree" },
      hands: {
        0: [c("9", "hearts"), c("10", "clubs"), c("9", "spades"), c("10", "diamonds"), c("9", "clubs")]
      }
    });

    const view = buildHumanHandView(state);

    expect(view.actionLabel).toBe("Choose Farmer's Hand replacements");
    expect(view.cards.every((card) => card.legal)).toBe(true);
    expect(view.cards.every((card) => card.farmersHandEligible)).toBe(true);
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

function move(action: MoveEvent["action"], sequence = 0): MoveEvent {
  return createMoveEvent(action, sequence);
}
