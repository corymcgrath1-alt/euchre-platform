import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import type { GameReview, SeatReviewStats, TeamReviewStats } from "@/lib/review/game-review";
import { buildProfileAggregates } from "./profile-aggregates";

describe("profile aggregates", () => {
  it("returns empty placeholder profiles when no completed games exist", () => {
    const profiles = buildProfileAggregates([]);

    expect(profiles.completedGames).toBe(0);
    expect(profiles.players).toHaveLength(4);
    expect(profiles.players[0]).toMatchObject({
      profileId: "local-seat-0",
      name: "South / Human",
      gamesPlayed: 0,
      winPercentage: 0,
      callSuccessPercentage: 0
    });
    expect(profiles.teams[0]).toMatchObject({
      gamesPlayed: 0,
      averagePointsPerGame: 0,
      makerSuccessPercentage: 0
    });
  });

  it("accumulates per-player and per-team stats from completed reviews", () => {
    const profiles = buildProfileAggregates([
      makeReview({
        gameId: "game-one",
        winningTeam: 0,
        finalScore: [10, 7],
        totalHandsPlayed: 6,
        teamZero: { makerHands: 4, successfulMakerHands: 3, failedMakerHands: 1, defenderEuchres: 2 },
        teamOne: { makerHands: 2, successfulMakerHands: 1, failedMakerHands: 1, defenderEuchres: 1 },
        south: { timesDealer: 2, timesCaller: 3, successfulCalls: 2, failedCalls: 1, loneAttempts: 1, successfulLoners: 1, tricksWon: 9, cardsPlayed: 30 }
      }),
      makeReview({
        gameId: "game-two",
        winningTeam: 1,
        finalScore: [8, 10],
        totalHandsPlayed: 5,
        teamZero: { makerHands: 3, successfulMakerHands: 1, failedMakerHands: 2, defenderEuchres: 0 },
        teamOne: { makerHands: 2, successfulMakerHands: 2, failedMakerHands: 0, defenderEuchres: 2 },
        south: { timesDealer: 1, timesCaller: 1, successfulCalls: 0, failedCalls: 1, loneAttempts: 0, successfulLoners: 0, tricksWon: 7, cardsPlayed: 25 }
      })
    ]);

    expect(profiles.completedGames).toBe(2);
    expect(profiles.sourceGameIds).toEqual(["game-one", "game-two"]);
    expect(profiles.players[0]).toMatchObject({
      name: "South / Human",
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      winPercentage: 50,
      pointsScored: 18,
      pointsAllowed: 17,
      handsPlayed: 11,
      timesDealer: 3,
      timesCaller: 4,
      successfulCalls: 2,
      failedCalls: 2,
      callSuccessPercentage: 50,
      loneAttempts: 1,
      successfulLoners: 1,
      tricksWon: 16,
      cardsPlayed: 55
    });
    expect(profiles.teams[0]).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      averagePointsPerGame: 9,
      makerHands: 7,
      successfulMakerHands: 4,
      makerSuccessPercentage: 57.1,
      euchresEarned: 2,
      euchresSuffered: 3
    });
    expect(profiles.teams[0].finalScores).toEqual([
      { gameId: "game-one", pointsFor: 10, pointsAgainst: 7 },
      { gameId: "game-two", pointsFor: 8, pointsAgainst: 10 }
    ]);
  });
});

function makeReview({
  gameId,
  winningTeam,
  finalScore,
  totalHandsPlayed,
  teamZero,
  teamOne,
  south
}: {
  gameId: string;
  winningTeam: 0 | 1;
  finalScore: [number, number];
  totalHandsPlayed: number;
  teamZero: Partial<TeamReviewStats>;
  teamOne: Partial<TeamReviewStats>;
  south: Partial<SeatReviewStats>;
}): GameReview {
  return {
    gameId,
    winningTeam,
    finalScore,
    totalHandsPlayed,
    totalEvents: 0,
    totalTricksPlayed: 0,
    totalEuchres: 0,
    totalSuccessfulMakerHands: 0,
    totalFailedMakerHands: 0,
    totalLoneAttempts: 0,
    totalSuccessfulLoneHands: 0,
    totalDealerPickups: 0,
    totalPassedHands: 0,
    longestScoringStreakByTeam: [0, 0],
    teams: [
      makeTeamStats(0, teamZero),
      makeTeamStats(1, teamOne)
    ],
    seats: [
      makeSeatStats(0, south),
      makeSeatStats(1),
      makeSeatStats(2),
      makeSeatStats(3)
    ],
    hands: [],
    ruleSummary: buildRuleSummary()
  };
}

function makeTeamStats(team: 0 | 1, overrides: Partial<TeamReviewStats>): TeamReviewStats {
  return {
    team,
    pointsScored: 0,
    handsWon: 0,
    makerHands: 0,
    successfulMakerHands: 0,
    failedMakerHands: 0,
    defenderEuchres: 0,
    tricksWon: 0,
    loneAttempts: 0,
    successfulLoners: 0,
    ...overrides
  };
}

function makeSeatStats(seat: 0 | 1 | 2 | 3, overrides: Partial<SeatReviewStats> = {}): SeatReviewStats {
  return {
    seat,
    team: seat % 2 as 0 | 1,
    handsDealt: 0,
    timesDealer: 0,
    timesCaller: 0,
    successfulCalls: 0,
    failedCalls: 0,
    loneAttempts: 0,
    successfulLoners: 0,
    tricksWon: 0,
    cardsPlayed: 0,
    firstTricksWon: 0,
    finalTricksWon: 0,
    ...overrides
  };
}
