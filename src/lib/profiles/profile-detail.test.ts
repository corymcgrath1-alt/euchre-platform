import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import type { GameReview, SeatReviewStats, TeamReviewStats } from "@/lib/review/game-review";
import { buildPlayerProfileDetail, isProfileSeat } from "./profile-detail";

describe("player profile detail", () => {
  it("returns an empty profile detail state when no games exist", () => {
    const detail = buildPlayerProfileDetail([], 0);

    expect(detail.name).toBe("South / Human");
    expect(detail.career.gamesPlayed).toBe(0);
    expect(detail.career.winPercentage).toBe(0);
    expect(detail.career.loneSuccessPercentage).toBeNull();
    expect(detail.gameHistory).toEqual([]);
    expect(detail.trends.currentStreak).toEqual({ result: "none", count: 0 });
    expect(detail.trends.last5GamesRecord).toEqual({ games: 0, wins: 0, losses: 0, winPercentage: 0 });
  });

  it("builds profile detail from one completed game", () => {
    const detail = buildPlayerProfileDetail([
      source("game-one", "2026-01-01T00:00:00.000Z", 0, [10, 7], seatStats({
        timesDealer: 2,
        timesCaller: 3,
        successfulCalls: 2,
        failedCalls: 1,
        loneAttempts: 1,
        successfulLoners: 1,
        tricksWon: 9,
        cardsPlayed: 30
      }), 6)
    ], 0);

    expect(detail.career).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      winPercentage: 100,
      pointsScored: 10,
      pointsAllowed: 7,
      averagePointsScoredPerGame: 10,
      averagePointsAllowedPerGame: 7,
      handsPlayed: 6,
      tricksWon: 9,
      averageTricksPerGame: 9,
      timesDealer: 2,
      timesCaller: 3,
      successfulCalls: 2,
      failedCalls: 1,
      callSuccessPercentage: 66.7,
      loneAttempts: 1,
      successfulLoners: 1,
      loneSuccessPercentage: 100,
      cardsPlayed: 30
    });
    expect(detail.gameHistory[0]).toMatchObject({
      gameId: "game-one",
      completedAt: "2026-01-01T00:00:00.000Z",
      result: "win",
      finalScore: [10, 7],
      playerTeam: 0,
      opponentTeam: 1,
      pointsScored: 10,
      pointsAllowed: 7,
      callsMade: 3,
      successfulCalls: 2,
      failedCalls: 1,
      tricksWon: 9,
      loneAttempts: 1,
      successfulLoners: 1,
      handsPlayed: 6,
      reviewHref: "/club/replay/game-one"
    });
  });

  it("builds multiple-game career, history, and trend stats", () => {
    const sources = [
      source("game-1", "2026-01-01T00:00:00.000Z", 0, [10, 7], seatStats({ successfulCalls: 1, timesCaller: 1, tricksWon: 4, cardsPlayed: 20 }), 4),
      source("game-2", "2026-01-02T00:00:00.000Z", 1, [8, 10], seatStats({ failedCalls: 1, timesCaller: 1, tricksWon: 5, cardsPlayed: 20 }), 4),
      source("game-3", "2026-01-03T00:00:00.000Z", 0, [10, 3], seatStats({ successfulCalls: 1, timesCaller: 2, tricksWon: 8, cardsPlayed: 25 }), 5),
      source("game-4", "2026-01-04T00:00:00.000Z", 0, [11, 9], seatStats({ successfulCalls: 1, failedCalls: 1, timesCaller: 2, tricksWon: 7, cardsPlayed: 25 }), 5),
      source("game-5", "2026-01-05T00:00:00.000Z", 1, [4, 10], seatStats({ failedCalls: 1, timesCaller: 1, tricksWon: 3, cardsPlayed: 20 }), 4),
      source("game-6", "2026-01-06T00:00:00.000Z", 1, [7, 10], seatStats({ failedCalls: 1, timesCaller: 1, tricksWon: 4, cardsPlayed: 20 }), 4)
    ];

    const detail = buildPlayerProfileDetail(sources, 0);

    expect(detail.gameHistory.map((game) => game.gameId)).toEqual([
      "game-6",
      "game-5",
      "game-4",
      "game-3",
      "game-2",
      "game-1"
    ]);
    expect(detail.career).toMatchObject({
      gamesPlayed: 6,
      wins: 3,
      losses: 3,
      winPercentage: 50,
      pointsScored: 50,
      pointsAllowed: 49,
      successfulCalls: 3,
      failedCalls: 4,
      callSuccessPercentage: 37.5,
      tricksWon: 31,
      averageTricksPerGame: 5.2
    });
    expect(detail.trends.last5GamesRecord).toEqual({ games: 5, wins: 2, losses: 3, winPercentage: 40 });
    expect(detail.trends.last10GamesRecord).toEqual({ games: 6, wins: 3, losses: 3, winPercentage: 50 });
    expect(detail.trends.recentWinPercentage).toBe(40);
    expect(detail.trends.recentCallSuccessPercentage).toBe(28.6);
    expect(detail.trends.recentAverageTricksPerGame).toBe(5.4);
    expect(detail.trends.currentStreak).toEqual({ result: "loss", count: 2 });
    expect(detail.trends.bestWinStreak).toBe(2);
    expect(detail.trends.worstLosingStreak).toBe(2);
  });

  it("validates placeholder profile seats", () => {
    expect(isProfileSeat(0)).toBe(true);
    expect(isProfileSeat(3)).toBe(true);
    expect(isProfileSeat(4)).toBe(false);
    expect(isProfileSeat(-1)).toBe(false);
  });
});

function source(
  gameId: string,
  completedAt: string,
  winningTeam: 0 | 1,
  finalScore: [number, number],
  south: SeatReviewStats,
  totalHandsPlayed: number
) {
  return {
    completedAt,
    createdAt: completedAt,
    review: makeReview(gameId, winningTeam, finalScore, south, totalHandsPlayed)
  };
}

function makeReview(
  gameId: string,
  winningTeam: 0 | 1,
  finalScore: [number, number],
  south: SeatReviewStats,
  totalHandsPlayed: number
): GameReview {
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
      teamStats(0),
      teamStats(1)
    ],
    seats: [
      south,
      seatStats({ seat: 1 }),
      seatStats({ seat: 2 }),
      seatStats({ seat: 3 })
    ],
    hands: [],
    ruleSummary: buildRuleSummary()
  };
}

function teamStats(team: 0 | 1): TeamReviewStats {
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
    successfulLoners: 0
  };
}

function seatStats(overrides: Partial<SeatReviewStats> = {}): SeatReviewStats {
  const seat = overrides.seat ?? 0;
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
