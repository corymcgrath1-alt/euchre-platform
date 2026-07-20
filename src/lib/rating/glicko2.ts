export type RatingQueue = "solo-queue" | "fixed-partners" | "tournament-seeding";

export interface RatingAccount {
  playerId: string;
  queue: RatingQueue;
  rating: number;
  deviation: number;
  volatility: number;
}

export interface TeamRating {
  teamId: string;
  players: [RatingAccount, RatingAccount];
}

export interface TeamStrength {
  teamId: string;
  rating: number;
  deviation: number;
  volatility: number;
}

export interface RatingLedgerEntry {
  matchId: string;
  queue: RatingQueue;
  playerId: string;
  teamId: string;
  result: 0 | 1;
  ratingBefore: number;
  ratingAfter: number;
  deviationBefore: number;
  deviationAfter: number;
  volatilityBefore: number;
  volatilityAfter: number;
  opposingTeamStrength: TeamStrength;
  algorithmVersion: string;
  timestamp: string;
  idempotencyKey: string;
}

export interface RateTeamMatchInput {
  matchId: string;
  queue: RatingQueue;
  teams: [TeamRating, TeamRating];
  winningTeamId: string;
  timestamp: string;
  idempotencyKey: string;
  existingLedger?: RatingLedgerEntry[];
}

export const GLICKO2_ALGORITHM_VERSION = "glicko2-team-v1";

const SCALE = 173.7178;
const DEFAULT_RATING = 1500;
const DEFAULT_DEVIATION = 350;
const DEFAULT_VOLATILITY = 0.06;
const TAU = 0.5;
const EPSILON = 0.000001;

export function createRatingAccount(
  playerId: string,
  queue: RatingQueue,
  partial: Partial<Omit<RatingAccount, "playerId" | "queue">> = {}
): RatingAccount {
  return {
    playerId,
    queue,
    rating: partial.rating ?? DEFAULT_RATING,
    deviation: partial.deviation ?? DEFAULT_DEVIATION,
    volatility: partial.volatility ?? DEFAULT_VOLATILITY
  };
}

export function estimateTeamStrength(team: TeamRating): TeamStrength {
  const rating = average(team.players.map((player) => player.rating));
  const deviation = Math.sqrt(team.players.reduce((sum, player) => sum + player.deviation ** 2, 0)) / team.players.length;
  const volatility = average(team.players.map((player) => player.volatility));

  return {
    teamId: team.teamId,
    rating: round(rating),
    deviation: round(deviation),
    volatility: round(volatility, 6)
  };
}

export function rateTeamMatch(input: RateTeamMatchInput): RatingLedgerEntry[] {
  validateMatchInput(input);

  const existing = input.existingLedger ?? [];
  const alreadyProcessed = existing.some((entry) => (
    entry.matchId === input.matchId &&
    entry.queue === input.queue &&
    entry.idempotencyKey === input.idempotencyKey
  ));
  if (alreadyProcessed) {
    return [];
  }

  const duplicatePlayerUpdate = new Set(existing
    .filter((entry) => entry.matchId === input.matchId && entry.queue === input.queue)
    .map((entry) => entry.playerId));

  const [teamA, teamB] = input.teams;
  const strengthA = estimateTeamStrength(teamA);
  const strengthB = estimateTeamStrength(teamB);
  const resultA: 0 | 1 = teamA.teamId === input.winningTeamId ? 1 : 0;
  const resultB: 0 | 1 = resultA === 1 ? 0 : 1;

  return [
    ...entriesForTeam({
      team: teamA,
      queue: input.queue,
      matchId: input.matchId,
      result: resultA,
      opponent: strengthB,
      timestamp: input.timestamp,
      idempotencyKey: input.idempotencyKey,
      duplicatePlayerUpdate
    }),
    ...entriesForTeam({
      team: teamB,
      queue: input.queue,
      matchId: input.matchId,
      result: resultB,
      opponent: strengthA,
      timestamp: input.timestamp,
      idempotencyKey: input.idempotencyKey,
      duplicatePlayerUpdate
    })
  ];
}

function entriesForTeam({
  team,
  queue,
  matchId,
  result,
  opponent,
  timestamp,
  idempotencyKey,
  duplicatePlayerUpdate
}: {
  team: TeamRating;
  queue: RatingQueue;
  matchId: string;
  result: 0 | 1;
  opponent: TeamStrength;
  timestamp: string;
  idempotencyKey: string;
  duplicatePlayerUpdate: Set<string>;
}): RatingLedgerEntry[] {
  return team.players.flatMap((player) => {
    if (duplicatePlayerUpdate.has(player.playerId)) {
      return [];
    }

    const after = updateGlicko2(player, opponent, result);
    return [{
      matchId,
      queue,
      playerId: player.playerId,
      teamId: team.teamId,
      result,
      ratingBefore: round(player.rating),
      ratingAfter: round(after.rating),
      deviationBefore: round(player.deviation),
      deviationAfter: round(after.deviation),
      volatilityBefore: round(player.volatility, 6),
      volatilityAfter: round(after.volatility, 6),
      opposingTeamStrength: opponent,
      algorithmVersion: GLICKO2_ALGORITHM_VERSION,
      timestamp,
      idempotencyKey
    }];
  });
}

function updateGlicko2(account: RatingAccount, opponent: TeamStrength, score: 0 | 1): Omit<RatingAccount, "playerId" | "queue"> {
  const mu = toMu(account.rating);
  const phi = toPhi(account.deviation);
  const sigma = account.volatility;
  const opponentMu = toMu(opponent.rating);
  const opponentPhi = toPhi(opponent.deviation);
  const g = glickoG(opponentPhi);
  const expected = expectedScore(mu, opponentMu, opponentPhi);
  const v = 1 / (g ** 2 * expected * (1 - expected));
  const delta = v * g * (score - expected);
  const sigmaPrime = newVolatility(phi, sigma, delta, v);
  const phiStar = Math.sqrt(phi ** 2 + sigmaPrime ** 2);
  const phiPrime = 1 / Math.sqrt((1 / phiStar ** 2) + (1 / v));
  const muPrime = mu + phiPrime ** 2 * g * (score - expected);

  return {
    rating: fromMu(muPrime),
    deviation: Math.max(30, fromPhi(phiPrime)),
    volatility: sigmaPrime
  };
}

function newVolatility(phi: number, sigma: number, delta: number, v: number): number {
  const a = Math.log(sigma ** 2);

  function f(x: number): number {
    const expX = Math.exp(x);
    const numerator = expX * (delta ** 2 - phi ** 2 - v - expX);
    const denominator = 2 * (phi ** 2 + v + expX) ** 2;
    return (numerator / denominator) - ((x - a) / TAU ** 2);
  }

  let lower = a;
  let upper: number;

  if (delta ** 2 > phi ** 2 + v) {
    upper = Math.log(delta ** 2 - phi ** 2 - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k += 1;
    }
    upper = a - k * TAU;
  }

  let fLower = f(lower);
  let fUpper = f(upper);

  while (Math.abs(upper - lower) > EPSILON) {
    const candidate = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fCandidate = f(candidate);
    if (fCandidate * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = candidate;
    fUpper = fCandidate;
  }

  return Math.exp(lower / 2);
}

function validateMatchInput(input: RateTeamMatchInput): void {
  const teamIds = input.teams.map((team) => team.teamId);
  if (!teamIds.includes(input.winningTeamId)) {
    throw new Error("Winning team must be one of the rated teams");
  }
  const playerKeys = input.teams.flatMap((team) => team.players.map((player) => `${player.queue}:${player.playerId}`));
  if (new Set(playerKeys).size !== playerKeys.length) {
    throw new Error("A player must not appear more than once in a rated match");
  }
  for (const team of input.teams) {
    for (const player of team.players) {
      if (player.queue !== input.queue) {
        throw new Error("All rating accounts must belong to the match queue");
      }
    }
  }
}

function toMu(rating: number): number {
  return (rating - DEFAULT_RATING) / SCALE;
}

function fromMu(mu: number): number {
  return DEFAULT_RATING + SCALE * mu;
}

function toPhi(deviation: number): number {
  return deviation / SCALE;
}

function fromPhi(phi: number): number {
  return phi * SCALE;
}

function glickoG(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-glickoG(opponentPhi) * (mu - opponentMu)));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}
