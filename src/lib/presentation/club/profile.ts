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

function seatLabel(seat: PlayerProfileDetail["seat"]): string {
  return ["South", "West", "North", "East"][seat];
}

function partnershipLabel(team: TeamIndex): string {
  return team === 0 ? "North / South" : "East / West";
}
