import { teamOf, type PlayerIndex, type RuleSummary, type TeamIndex } from "@/lib/euchre";
import type { GameReview } from "@/lib/review/game-review";
import { buildProfileAggregates, LOCAL_PLAYER_PROFILES, type PlayerProfileAggregate } from "./profile-aggregates";

export interface ProfileReviewSource {
  review: GameReview;
  createdAt?: string;
  completedAt?: string;
}

export interface ProfileCareerSummary extends PlayerProfileAggregate {
  teamLabel: string;
  averagePointsScoredPerGame: number;
  averagePointsAllowedPerGame: number;
  averageTricksPerGame: number;
  loneSuccessPercentage: number | null;
}

export interface ProfileGameHistoryRow {
  gameId: string;
  createdAt?: string;
  completedAt?: string;
  result: "win" | "loss";
  finalScore: [number, number];
  playerTeam: TeamIndex;
  opponentTeam: TeamIndex;
  pointsScored: number;
  pointsAllowed: number;
  callsMade: number;
  successfulCalls: number;
  failedCalls: number;
  tricksWon: number;
  loneAttempts: number;
  successfulLoners: number;
  handsPlayed: number;
  ruleSummary: RuleSummary;
  reviewHref: string;
}

export interface TrendRecord {
  games: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

export interface ProfileTrendStats {
  last5GamesRecord: TrendRecord;
  last10GamesRecord: TrendRecord;
  recentWinPercentage: number;
  recentCallSuccessPercentage: number;
  recentAverageTricksPerGame: number;
  currentStreak: {
    result: "win" | "loss" | "none";
    count: number;
  };
  bestWinStreak: number;
  worstLosingStreak: number;
}

export interface PlayerProfileDetail {
  profileId: string;
  name: string;
  seat: PlayerIndex;
  team: TeamIndex;
  teamLabel: string;
  career: ProfileCareerSummary;
  trends: ProfileTrendStats;
  gameHistory: ProfileGameHistoryRow[];
}

export function isProfileSeat(value: number): value is PlayerIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function buildPlayerProfileDetail(sources: ProfileReviewSource[], seat: PlayerIndex): PlayerProfileDetail {
  const orderedSources = [...sources].sort(compareProfileSources);
  const reviews = orderedSources.map((source) => source.review);
  const aggregate = buildProfileAggregates(reviews).players[seat];
  const team = teamOf(seat);
  const gameHistory = [...orderedSources]
    .reverse()
    .map((source) => buildGameHistoryRow(source, seat, team));

  return {
    profileId: LOCAL_PLAYER_PROFILES[seat].id,
    name: LOCAL_PLAYER_PROFILES[seat].name,
    seat,
    team,
    teamLabel: `Team ${team}`,
    career: {
      ...aggregate,
      teamLabel: `Team ${team}`,
      averagePointsScoredPerGame: average(aggregate.pointsScored, aggregate.gamesPlayed),
      averagePointsAllowedPerGame: average(aggregate.pointsAllowed, aggregate.gamesPlayed),
      averageTricksPerGame: average(aggregate.tricksWon, aggregate.gamesPlayed),
      loneSuccessPercentage: aggregate.loneAttempts > 0
        ? percentage(aggregate.successfulLoners, aggregate.loneAttempts)
        : null
    },
    trends: buildTrendStats(gameHistory),
    gameHistory
  };
}

function buildGameHistoryRow(source: ProfileReviewSource, seat: PlayerIndex, team: TeamIndex): ProfileGameHistoryRow {
  const review = source.review;
  const opponentTeam = oppositeTeam(team);
  const seatStats = review.seats[seat];

  return {
    gameId: review.gameId,
    createdAt: source.createdAt,
    completedAt: source.completedAt,
    result: review.winningTeam === team ? "win" : "loss",
    finalScore: [...review.finalScore],
    playerTeam: team,
    opponentTeam,
    pointsScored: review.finalScore[team],
    pointsAllowed: review.finalScore[opponentTeam],
    callsMade: seatStats.timesCaller,
    successfulCalls: seatStats.successfulCalls,
    failedCalls: seatStats.failedCalls,
    tricksWon: seatStats.tricksWon,
    loneAttempts: seatStats.loneAttempts,
    successfulLoners: seatStats.successfulLoners,
    handsPlayed: review.totalHandsPlayed,
    ruleSummary: review.ruleSummary,
    reviewHref: `/club/replay/${review.gameId}`
  };
}

function buildTrendStats(gameHistory: ProfileGameHistoryRow[]): ProfileTrendStats {
  const last5 = gameHistory.slice(0, 5);
  const last10 = gameHistory.slice(0, 10);

  return {
    last5GamesRecord: recordFor(last5),
    last10GamesRecord: recordFor(last10),
    recentWinPercentage: percentage(countWins(last5), last5.length),
    recentCallSuccessPercentage: callSuccessFor(last5),
    recentAverageTricksPerGame: average(
      last5.reduce((sum, game) => sum + game.tricksWon, 0),
      last5.length
    ),
    currentStreak: currentStreakFor(gameHistory),
    bestWinStreak: bestStreakFor(gameHistory, "win"),
    worstLosingStreak: bestStreakFor(gameHistory, "loss")
  };
}

function recordFor(games: ProfileGameHistoryRow[]): TrendRecord {
  const wins = countWins(games);
  return {
    games: games.length,
    wins,
    losses: games.length - wins,
    winPercentage: percentage(wins, games.length)
  };
}

function currentStreakFor(games: ProfileGameHistoryRow[]): ProfileTrendStats["currentStreak"] {
  const [latest] = games;
  if (!latest) {
    return { result: "none", count: 0 };
  }

  let count = 0;
  for (const game of games) {
    if (game.result !== latest.result) {
      break;
    }
    count += 1;
  }

  return { result: latest.result, count };
}

function bestStreakFor(games: ProfileGameHistoryRow[], result: "win" | "loss"): number {
  let best = 0;
  let current = 0;
  for (const game of [...games].reverse()) {
    if (game.result === result) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function callSuccessFor(games: ProfileGameHistoryRow[]): number {
  const successful = games.reduce((sum, game) => sum + game.successfulCalls, 0);
  const total = games.reduce((sum, game) => sum + game.callsMade, 0);
  return percentage(successful, total);
}

function countWins(games: ProfileGameHistoryRow[]): number {
  return games.filter((game) => game.result === "win").length;
}

function compareProfileSources(a: ProfileReviewSource, b: ProfileReviewSource): number {
  return timestampFor(a).localeCompare(timestampFor(b)) || a.review.gameId.localeCompare(b.review.gameId);
}

function timestampFor(source: ProfileReviewSource): string {
  return source.completedAt ?? source.createdAt ?? "";
}

function oppositeTeam(team: TeamIndex): TeamIndex {
  return team === 0 ? 1 : 0;
}

function average(total: number, count: number): number {
  return count === 0 ? 0 : roundRate(total / count);
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : roundRate((numerator / denominator) * 100);
}

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}
