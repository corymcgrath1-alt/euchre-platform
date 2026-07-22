import type { ProfileAggregateSummary } from "@/lib/profiles/profile-aggregates";
import type { PlayerProfileDetail } from "@/lib/profiles/profile-detail";
import type { TeamIndex } from "@/lib/euchre";

export interface ClubProfileRecordView {
  completedGames: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface ClubProfilePerformanceView {
  callSuccess: number;
  makerSuccess: number;
  euchresEarned: number;
  euchresSuffered: number;
}

export interface ClubProfileGameView {
  gameId: string;
  result: "win" | "loss";
  finalScore: [number, number];
  pointsScored: number;
  pointsAllowed: number;
  completedAt?: string;
  handsPlayed: number;
}

export interface ClubProfileDashboardView {
  authentication: "local-unauthenticated";
  profileId: string;
  displayName: string;
  seatLabel: string;
  partnershipLabel: string;
  sourceLabel: string;
  isEmpty: boolean;
  record: ClubProfileRecordView;
  performance: ClubProfilePerformanceView;
  recentGames: ClubProfileGameView[];
}

export interface ClubProfileDetailView {
  authentication: "local-unauthenticated";
  profileId: string;
  displayName: string;
  seatLabel: string;
  partnershipLabel: string;
  isEmpty: boolean;
  career: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winPercentage: number;
    pointsScored: number;
    pointsAllowed: number;
    handsPlayed: number;
    timesDealer: number;
    successfulCalls: number;
    failedCalls: number;
    callSuccessPercentage: number;
    tricksWon: number;
    loneAttempts: number;
    successfulLoners: number;
  };
  games: Array<{
    gameId: string;
    result: "win" | "loss";
    pointsScored: number;
    pointsAllowed: number;
    handsPlayed: number;
    completedAt?: string;
    replayHref: string;
  }>;
}

export function buildClubProfileDashboardView(
  summary: ProfileAggregateSummary,
  profile: PlayerProfileDetail
): ClubProfileDashboardView {
  const team = summary.teams[profile.team];

  return {
    authentication: "local-unauthenticated",
    profileId: profile.profileId,
    displayName: profile.name,
    seatLabel: seatLabel(profile.seat),
    partnershipLabel: partnershipLabel(profile.team),
    sourceLabel: "Completed persisted Practice games",
    isEmpty: summary.completedGames === 0,
    record: {
      completedGames: summary.completedGames,
      wins: profile.career.wins,
      losses: profile.career.losses,
      winRate: profile.career.winPercentage
    },
    performance: {
      callSuccess: profile.career.callSuccessPercentage,
      makerSuccess: team.makerSuccessPercentage,
      euchresEarned: team.euchresEarned,
      euchresSuffered: team.euchresSuffered
    },
    recentGames: profile.gameHistory.slice(0, 5).map((game) => ({
      gameId: game.gameId,
      result: game.result,
      finalScore: [...game.finalScore],
      pointsScored: game.pointsScored,
      pointsAllowed: game.pointsAllowed,
      completedAt: game.completedAt,
      handsPlayed: game.handsPlayed
    }))
  };
}

export function buildClubProfileDetailView(profile: PlayerProfileDetail): ClubProfileDetailView {
  return {
    authentication: "local-unauthenticated",
    profileId: profile.profileId,
    displayName: profile.name,
    seatLabel: seatLabel(profile.seat),
    partnershipLabel: partnershipLabel(profile.team),
    isEmpty: profile.gameHistory.length === 0,
    career: {
      gamesPlayed: profile.career.gamesPlayed,
      wins: profile.career.wins,
      losses: profile.career.losses,
      winPercentage: profile.career.winPercentage,
      pointsScored: profile.career.pointsScored,
      pointsAllowed: profile.career.pointsAllowed,
      handsPlayed: profile.career.handsPlayed,
      timesDealer: profile.career.timesDealer,
      successfulCalls: profile.career.successfulCalls,
      failedCalls: profile.career.failedCalls,
      callSuccessPercentage: profile.career.callSuccessPercentage,
      tricksWon: profile.career.tricksWon,
      loneAttempts: profile.career.loneAttempts,
      successfulLoners: profile.career.successfulLoners
    },
    games: profile.gameHistory.map((game) => ({
      gameId: game.gameId,
      result: game.result,
      pointsScored: game.pointsScored,
      pointsAllowed: game.pointsAllowed,
      handsPlayed: game.handsPlayed,
      completedAt: game.completedAt,
      replayHref: game.reviewHref
    }))
  };
}

function seatLabel(seat: PlayerProfileDetail["seat"]): string {
  return ["South", "West", "North", "East"][seat];
}

function partnershipLabel(team: TeamIndex): string {
  return team === 0 ? "North / South" : "East / West";
}
