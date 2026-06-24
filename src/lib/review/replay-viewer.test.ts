import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import type { GameReview, HandReview, TrickReview } from "./game-review";
import {
  createInitialReplaySelection,
  getSelectedReplay,
  nextReplayHand,
  nextReplayTrick,
  previousReplayHand,
  previousReplayTrick,
  resetReplaySelection,
  selectReplayHand,
  selectReplayTrick
} from "./replay-viewer";

describe("hand replay viewer selection", () => {
  it("starts at the first hand and first trick", () => {
    expect(createInitialReplaySelection(makeReview())).toEqual({ handIndex: 0, trickIndex: 0 });
  });

  it("clamps previous and next hand navigation at the first and last hand", () => {
    const review = makeReview();

    expect(previousReplayHand(review, { handIndex: 0, trickIndex: 1 })).toEqual({ handIndex: 0, trickIndex: 0 });
    expect(nextReplayHand(review, { handIndex: 0, trickIndex: 1 })).toEqual({ handIndex: 1, trickIndex: 0 });
    expect(nextReplayHand(review, { handIndex: 1, trickIndex: 0 })).toEqual({ handIndex: 1, trickIndex: 0 });
    expect(selectReplayHand(review, 99)).toEqual({ handIndex: 1, trickIndex: 0 });
  });

  it("clamps previous and next trick navigation at the first and last trick", () => {
    const review = makeReview();

    expect(previousReplayTrick(review, { handIndex: 0, trickIndex: 0 })).toEqual({ handIndex: 0, trickIndex: 0 });
    expect(nextReplayTrick(review, { handIndex: 0, trickIndex: 0 })).toEqual({ handIndex: 0, trickIndex: 1 });
    expect(nextReplayTrick(review, { handIndex: 0, trickIndex: 1 })).toEqual({ handIndex: 0, trickIndex: 1 });
    expect(selectReplayTrick(review, { handIndex: 0, trickIndex: 0 }, 99)).toEqual({ handIndex: 0, trickIndex: 1 });
  });

  it("resets to the first hand and first trick", () => {
    expect(resetReplaySelection(makeReview())).toEqual({ handIndex: 0, trickIndex: 0 });
  });

  it("exposes all selected trick card plays in order", () => {
    const selected = getSelectedReplay(makeReview(), { handIndex: 0, trickIndex: 1 });

    expect(selected.hand?.handNumber).toBe(1);
    expect(selected.trick?.cardsPlayed.map((play) => play.player)).toEqual([1, 2, 3, 0]);
    expect(selected.trick?.cardsPlayed.map((play) => play.order)).toEqual([1, 2, 3, 4]);
  });

  it("surfaces winning card, winning seat, and winning team", () => {
    const selected = getSelectedReplay(makeReview(), { handIndex: 0, trickIndex: 0 });

    expect(selected.trick?.winningSeat).toBe(2);
    expect(selected.trick?.winningTeam).toBe(0);
    expect(selected.winningPlay?.player).toBe(2);
    expect(selected.winningPlay?.card).toEqual({ rank: "A", suit: "clubs" });
  });
});

function makeReview(): GameReview {
  return {
    gameId: "game-test",
    winningTeam: 0,
    finalScore: [10, 4],
    totalHandsPlayed: 2,
    totalEvents: 54,
    totalTricksPlayed: 10,
    totalEuchres: 1,
    totalSuccessfulMakerHands: 1,
    totalFailedMakerHands: 1,
    totalLoneAttempts: 0,
    totalSuccessfulLoneHands: 0,
    totalDealerPickups: 1,
    totalPassedHands: 0,
    longestScoringStreakByTeam: [2, 1],
    teams: [
      { team: 0, pointsScored: 10, handsWon: 2, makerHands: 1, successfulMakerHands: 1, failedMakerHands: 0, defenderEuchres: 1, tricksWon: 6, loneAttempts: 0, successfulLoners: 0 },
      { team: 1, pointsScored: 4, handsWon: 1, makerHands: 1, successfulMakerHands: 0, failedMakerHands: 1, defenderEuchres: 0, tricksWon: 4, loneAttempts: 0, successfulLoners: 0 }
    ],
    seats: [
      { seat: 0, team: 0, handsDealt: 1, timesDealer: 1, timesCaller: 0, successfulCalls: 0, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 3, cardsPlayed: 10, firstTricksWon: 1, finalTricksWon: 1 },
      { seat: 1, team: 1, handsDealt: 1, timesDealer: 1, timesCaller: 1, successfulCalls: 0, failedCalls: 1, loneAttempts: 0, successfulLoners: 0, tricksWon: 2, cardsPlayed: 10, firstTricksWon: 0, finalTricksWon: 0 },
      { seat: 2, team: 0, handsDealt: 0, timesDealer: 0, timesCaller: 1, successfulCalls: 1, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 3, cardsPlayed: 10, firstTricksWon: 1, finalTricksWon: 1 },
      { seat: 3, team: 1, handsDealt: 0, timesDealer: 0, timesCaller: 0, successfulCalls: 0, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 2, cardsPlayed: 10, firstTricksWon: 0, finalTricksWon: 0 }
    ],
    hands: [makeHand(1), makeHand(2)],
    ruleSummary: buildRuleSummary()
  };
}

function makeHand(handNumber: number): HandReview {
  return {
    handNumber,
    dealer: handNumber === 1 ? 0 : 1,
    upcard: { rank: "9", suit: "clubs" },
    trumpSuit: "clubs",
    maker: handNumber === 1 ? 1 : 2,
    makerTeam: handNumber === 1 ? 1 : 0,
    defendingTeam: handNumber === 1 ? 0 : 1,
    aloneDeclared: false,
    roundOneBids: [],
    roundTwoBids: [],
    tricks: [makeTrick(handNumber, 1), makeTrick(handNumber, 2)],
    makerTricks: handNumber === 1 ? 2 : 3,
    defenderTricks: handNumber === 1 ? 3 : 2,
    scoringResult: handNumber === 1 ? "euchre" : "makers-point",
    pointsAwarded: handNumber === 1 ? [2, 0] : [1, 0],
    teamScoreAfterHand: handNumber === 1 ? [2, 0] : [3, 0],
    tricksWon: handNumber === 1 ? [3, 2] : [3, 2],
    makersSucceeded: handNumber !== 1,
    defendersEuchredMakers: handNumber === 1,
    euchred: handNumber === 1,
    lone: false,
    loneSucceeded: false,
    passed: false
  };
}

function makeTrick(handNumber: number, trickNumber: number): TrickReview {
  const players = trickNumber === 1 ? [0, 1, 2, 3] : [1, 2, 3, 0];
  return {
    handNumber,
    trickNumber,
    leader: players[0] as 0 | 1 | 2 | 3,
    cardsPlayed: players.map((player, index) => ({
      sequenceNumber: handNumber * 100 + trickNumber * 10 + index,
      order: index + 1,
      player: player as 0 | 1 | 2 | 3,
      team: (player % 2) as 0 | 1,
      card: index === 2 ? { rank: "A" as const, suit: "clubs" as const } : { rank: "9" as const, suit: index % 2 === 0 ? "hearts" as const : "spades" as const },
      effectiveSuit: index === 2 ? "clubs" : index % 2 === 0 ? "hearts" : "spades",
      playedTrump: index === 2
    })),
    winningSeat: 2,
    winningTeam: 0,
    ledSuit: "hearts",
    trumpSuit: "clubs",
    trumpPlayed: true,
    winnerUsedTrump: true,
    winnerRelationToCaller: handNumber === 1 ? "opponent" : "caller"
  };
}
