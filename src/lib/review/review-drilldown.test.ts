import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import type { GameReviewSummary } from "./game-review";
import {
  chooseActiveReviewSource,
  clearHistoricalReviewState,
  formatReviewedGameLabel,
  initializeReplaySelectionForReview,
  profileHistoryGameId
} from "./review-drilldown";

describe("profile game-history review drilldown", () => {
  it("selects a profile history game id", () => {
    expect(profileHistoryGameId("game-history")).toBe("game-history");
  });

  it("defaults a loaded historical review to the first hand and first trick", () => {
    expect(initializeReplaySelectionForReview(makeReview("game-history"))).toEqual({
      handIndex: 0,
      trickIndex: 0
    });
  });

  it("chooses historical review over current review when both are available", () => {
    const currentReview = makeReview("game-current");
    const historicalReview = { gameId: "game-history", review: makeReview("game-history") };

    expect(chooseActiveReviewSource({ currentReview, historicalReview })).toMatchObject({
      kind: "historical",
      gameId: "game-history",
      review: historicalReview.review
    });
  });

  it("clearing historical review returns active source to the current game review", () => {
    const currentReview = makeReview("game-current");

    const cleared = clearHistoricalReviewState();

    expect(cleared).toBeNull();
    expect(chooseActiveReviewSource({ currentReview, historicalReview: cleared })).toMatchObject({
      kind: "current",
      gameId: "game-current",
      review: currentReview
    });
  });

  it("formats reviewed game labels", () => {
    expect(formatReviewedGameLabel("current", "game-current")).toBe("Current game review: game-current");
    expect(formatReviewedGameLabel("historical", "game-history")).toBe("Historical review: game-history");
  });
});

function makeReview(gameId: string): GameReviewSummary {
  return {
    gameId,
    winningTeam: 0,
    finalScore: [10, 5],
    totalHandsPlayed: 1,
    totalEvents: 24,
    totalTricksPlayed: 1,
    totalEuchres: 0,
    totalSuccessfulMakerHands: 1,
    totalFailedMakerHands: 0,
    totalLoneAttempts: 0,
    totalSuccessfulLoneHands: 0,
    totalDealerPickups: 0,
    totalPassedHands: 0,
    longestScoringStreakByTeam: [1, 0],
    teams: [
      { team: 0, pointsScored: 10, handsWon: 1, makerHands: 1, successfulMakerHands: 1, failedMakerHands: 0, defenderEuchres: 0, tricksWon: 3, loneAttempts: 0, successfulLoners: 0 },
      { team: 1, pointsScored: 5, handsWon: 0, makerHands: 0, successfulMakerHands: 0, failedMakerHands: 0, defenderEuchres: 0, tricksWon: 2, loneAttempts: 0, successfulLoners: 0 }
    ],
    seats: [
      { seat: 0, team: 0, handsDealt: 1, timesDealer: 1, timesCaller: 1, successfulCalls: 1, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 1, cardsPlayed: 5, firstTricksWon: 1, finalTricksWon: 0 },
      { seat: 1, team: 1, handsDealt: 0, timesDealer: 0, timesCaller: 0, successfulCalls: 0, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 0, cardsPlayed: 5, firstTricksWon: 0, finalTricksWon: 0 },
      { seat: 2, team: 0, handsDealt: 0, timesDealer: 0, timesCaller: 0, successfulCalls: 0, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 1, cardsPlayed: 5, firstTricksWon: 0, finalTricksWon: 1 },
      { seat: 3, team: 1, handsDealt: 0, timesDealer: 0, timesCaller: 0, successfulCalls: 0, failedCalls: 0, loneAttempts: 0, successfulLoners: 0, tricksWon: 0, cardsPlayed: 5, firstTricksWon: 0, finalTricksWon: 0 }
    ],
    hands: [
      {
        handNumber: 1,
        dealer: 0,
        upcard: { rank: "9", suit: "clubs" },
        trumpSuit: "clubs",
        maker: 0,
        makerTeam: 0,
        defendingTeam: 1,
        aloneDeclared: false,
        roundOneBids: [],
        roundTwoBids: [],
        tricks: [],
        makerTricks: 3,
        defenderTricks: 2,
        scoringResult: "makers-point",
        pointsAwarded: [1, 0],
        teamScoreAfterHand: [1, 0],
        tricksWon: [3, 2],
        makersSucceeded: true,
        defendersEuchredMakers: false,
        euchred: false,
        lone: false,
        loneSucceeded: false,
        passed: false
      }
    ],
    ruleSummary: buildRuleSummary()
  };
}
