import { teamOf, type PlayerIndex, type TeamIndex } from "@/lib/euchre";
import type { GameReview } from "@/lib/review/game-review";

const SEATS = [0, 1, 2, 3] as const;
const TEAMS = [0, 1] as const;

export const LOCAL_PLAYER_PROFILES: Record<PlayerIndex, { id: string; name: string }> = {
  0: { id: "local-seat-0", name: "South / Human" },
  1: { id: "local-seat-1", name: "West Bot" },
  2: { id: "local-seat-2", name: "North Bot" },
  3: { id: "local-seat-3", name: "East Bot" }
};

export interface PlayerProfileAggregate {
  profileId: string;
  name: string;
  seat: PlayerIndex;
  team: TeamIndex;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  pointsScored: number;
  pointsAllowed: number;
  handsPlayed: number;
  timesDealer: number;
  timesCaller: number;
  successfulCalls: number;
  failedCalls: number;
  callSuccessPercentage: number;
  loneAttempts: number;
  successfulLoners: number;
  tricksWon: number;
  cardsPlayed: number;
}

export interface TeamFinalScoreAggregate {
  gameId: string;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TeamProfileAggregate {
  team: TeamIndex;
  label: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  finalScores: TeamFinalScoreAggregate[];
  averagePointsPerGame: number;
  makerHands: number;
  successfulMakerHands: number;
  makerSuccessPercentage: number;
  euchresEarned: number;
  euchresSuffered: number;
}

export interface ProfileAggregateSummary {
  source: "completed-game-reviews";
  completedGames: number;
  sourceGameIds: string[];
  players: [PlayerProfileAggregate, PlayerProfileAggregate, PlayerProfileAggregate, PlayerProfileAggregate];
  teams: [TeamProfileAggregate, TeamProfileAggregate];
}

export function buildProfileAggregates(reviews: GameReview[]): ProfileAggregateSummary {
  const players = makePlayerAggregates();
  const teams = makeTeamAggregates();

  for (const review of reviews) {
    for (const seat of SEATS) {
      const player = players[seat];
      const team = teamOf(seat);
      const opponentTeam = oppositeTeam(team);
      const seatStats = review.seats[seat];

      player.gamesPlayed += 1;
      if (review.winningTeam === team) {
        player.wins += 1;
      } else {
        player.losses += 1;
      }
      player.pointsScored += review.finalScore[team];
      player.pointsAllowed += review.finalScore[opponentTeam];
      player.handsPlayed += review.totalHandsPlayed;
      player.timesDealer += seatStats.timesDealer;
      player.timesCaller += seatStats.timesCaller;
      player.successfulCalls += seatStats.successfulCalls;
      player.failedCalls += seatStats.failedCalls;
      player.loneAttempts += seatStats.loneAttempts;
      player.successfulLoners += seatStats.successfulLoners;
      player.tricksWon += seatStats.tricksWon;
      player.cardsPlayed += seatStats.cardsPlayed;
    }

    for (const team of TEAMS) {
      const teamAggregate = teams[team];
      const opponentTeam = oppositeTeam(team);
      const teamStats = review.teams[team];

      teamAggregate.gamesPlayed += 1;
      if (review.winningTeam === team) {
        teamAggregate.wins += 1;
      } else {
        teamAggregate.losses += 1;
      }
      teamAggregate.finalScores.push({
        gameId: review.gameId,
        pointsFor: review.finalScore[team],
        pointsAgainst: review.finalScore[opponentTeam]
      });
      teamAggregate.makerHands += teamStats.makerHands;
      teamAggregate.successfulMakerHands += teamStats.successfulMakerHands;
      teamAggregate.euchresEarned += teamStats.defenderEuchres;
      teamAggregate.euchresSuffered += teamStats.failedMakerHands;
    }
  }

  for (const player of players) {
    player.winPercentage = percentage(player.wins, player.gamesPlayed);
    player.callSuccessPercentage = percentage(player.successfulCalls, player.timesCaller);
  }

  for (const team of teams) {
    const totalPoints = team.finalScores.reduce((sum, score) => sum + score.pointsFor, 0);
    team.averagePointsPerGame = roundRate(team.gamesPlayed === 0 ? 0 : totalPoints / team.gamesPlayed);
    team.makerSuccessPercentage = percentage(team.successfulMakerHands, team.makerHands);
  }

  return {
    source: "completed-game-reviews",
    completedGames: reviews.length,
    sourceGameIds: reviews.map((review) => review.gameId),
    players,
    teams
  };
}

function makePlayerAggregates(): ProfileAggregateSummary["players"] {
  return [
    makePlayerAggregate(0),
    makePlayerAggregate(1),
    makePlayerAggregate(2),
    makePlayerAggregate(3)
  ];
}

function makePlayerAggregate(seat: PlayerIndex): PlayerProfileAggregate {
  return {
    profileId: LOCAL_PLAYER_PROFILES[seat].id,
    name: LOCAL_PLAYER_PROFILES[seat].name,
    seat,
    team: teamOf(seat),
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winPercentage: 0,
    pointsScored: 0,
    pointsAllowed: 0,
    handsPlayed: 0,
    timesDealer: 0,
    timesCaller: 0,
    successfulCalls: 0,
    failedCalls: 0,
    callSuccessPercentage: 0,
    loneAttempts: 0,
    successfulLoners: 0,
    tricksWon: 0,
    cardsPlayed: 0
  };
}

function makeTeamAggregates(): ProfileAggregateSummary["teams"] {
  return [
    makeTeamAggregate(0),
    makeTeamAggregate(1)
  ];
}

function makeTeamAggregate(team: TeamIndex): TeamProfileAggregate {
  return {
    team,
    label: `Team ${team}`,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    finalScores: [],
    averagePointsPerGame: 0,
    makerHands: 0,
    successfulMakerHands: 0,
    makerSuccessPercentage: 0,
    euchresEarned: 0,
    euchresSuffered: 0
  };
}

function oppositeTeam(team: TeamIndex): TeamIndex {
  return team === 0 ? 1 : 0;
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : roundRate((numerator / denominator) * 100);
}

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}
