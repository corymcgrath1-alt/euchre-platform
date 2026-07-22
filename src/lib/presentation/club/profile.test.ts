import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import { buildProfileAggregates } from "@/lib/profiles/profile-aggregates";
import { buildPlayerProfileDetail } from "@/lib/profiles/profile-detail";
import type { GameReview, SeatReviewStats, TeamReviewStats } from "@/lib/review/game-review";
import { buildClubProfileDashboardView } from "./profile";

describe("Club profile presentation", () => {
  it("maps only completed-review aggregates into the dashboard", () => {
    const review = makeReview();
    const source = { review, createdAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-02T00:00:00.000Z" };
    const summary = buildProfileAggregates([review]);
    const profile = buildPlayerProfileDetail([source], 0);
    const before = JSON.stringify({ summary, profile });

    const view = buildClubProfileDashboardView(summary, profile);

    expect(view).toMatchObject({
      authentication: "local-unauthenticated",
      profileId: "local-seat-0",
      displayName: "South / Human",
      seatLabel: "South",
      partnershipLabel: "North / South",
      sourceLabel: "Completed persisted Practice games",
      isEmpty: false,
      record: {
        completedGames: 1,
        wins: 1,
        losses: 0,
        winRate: 100
      },
      performance: {
        callSuccess: 66.7,
        makerSuccess: 75,
        euchresEarned: 2,
        euchresSuffered: 1
      }
    });
    expect(view.recentGames).toEqual([
      {
        gameId: "persisted-game",
        result: "win",
        finalScore: [10, 7],
        pointsScored: 10,
        pointsAllowed: 7,
        completedAt: "2026-01-02T00:00:00.000Z",
        handsPlayed: 6
      }
    ]);
    expect(JSON.stringify({ summary, profile })).toBe(before);
  });

  it("preserves an explicit empty local profile without synthetic competition data", () => {
    const summary = buildProfileAggregates([]);
    const profile = buildPlayerProfileDetail([], 0);

    expect(buildClubProfileDashboardView(summary, profile)).toMatchObject({
      authentication: "local-unauthenticated",
      isEmpty: true,
      record: { completedGames: 0, wins: 0, losses: 0, winRate: 0 },
      performance: { callSuccess: 0, makerSuccess: 0, euchresEarned: 0, euchresSuffered: 0 },
      recentGames: []
    });
  });
});

function makeReview(): GameReview {
  return {
    gameId: "persisted-game",
    winningTeam: 0,
    finalScore: [10, 7],
    totalHandsPlayed: 6,
    totalEvents: 85,
    totalTricksPlayed: 30,
    totalEuchres: 3,
    totalSuccessfulMakerHands: 5,
    totalFailedMakerHands: 2,
    totalLoneAttempts: 1,
    totalSuccessfulLoneHands: 0,
    totalDealerPickups: 2,
    totalPassedHands: 0,
    longestScoringStreakByTeam: [2, 1],
    teams: [
      teamStats(0, { makerHands: 4, successfulMakerHands: 3, failedMakerHands: 1, defenderEuchres: 2 }),
      teamStats(1, { makerHands: 3, successfulMakerHands: 2, failedMakerHands: 1, defenderEuchres: 1 })
    ],
    seats: [
      seatStats(0, { timesCaller: 3, successfulCalls: 2, failedCalls: 1, tricksWon: 9, cardsPlayed: 30 }),
      seatStats(1),
      seatStats(2),
      seatStats(3)
    ],
    hands: [],
    ruleSummary: buildRuleSummary()
  };
}

function teamStats(team: 0 | 1, overrides: Partial<TeamReviewStats>): TeamReviewStats {
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

function seatStats(seat: 0 | 1 | 2 | 3, overrides: Partial<SeatReviewStats> = {}): SeatReviewStats {
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
