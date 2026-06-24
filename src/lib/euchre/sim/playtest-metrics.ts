import { teamOf } from "../deck";
import type { BotPolicyId, BotPolicyMetadata } from "../bot-policies";
import type { BotDifficulty, GameConfig, GameState, PlayerIndex, Suit, TeamIndex } from "../types";

export interface SeatOutcomeMetrics {
  hands: number;
  successes: number;
  euchres: number;
  marches: number;
  points: number;
  successRate: number;
  euchreRate: number;
  marchRate: number;
}

export interface DealerSeatMetrics {
  hands: number;
  dealerTeamHandsWon: number;
  dealerTeamPoints: number;
  dealerTeamHandWinRate: number;
}

export interface PlaytestMetrics {
  totalGames: number;
  completedGames: number;
  failedGames: number;
  totalHands: number;
  elapsedMs: number;
  averageHandsPerGame: number;
  averagePointsPerHand: number;
  failureCountByReason: Record<string, number>;
  invariantWarningsByCode: Record<string, number>;
  finalScoreDistribution: Record<string, number>;
  teamWins: [number, number];
  teamWinRates: [number, number];
  averageWinningScore: number;
  averageLosingScore: number;
  dealerSeatDistribution: Record<PlayerIndex, number>;
  initialDealerGames: Record<PlayerIndex, number>;
  winsByInitialDealer: Record<PlayerIndex, number>;
  winRateByInitialDealer: Record<PlayerIndex, number>;
  handOutcomesByDealerSeat: Record<PlayerIndex, DealerSeatMetrics>;
  makerOutcomesByMakerSeat: Record<PlayerIndex, SeatOutcomeMetrics>;
  callerOutcomesByCallerSeat: Record<PlayerIndex, SeatOutcomeMetrics>;
  trumpSuitDistribution: Record<Suit, number>;
  upcardSuitDistribution: Record<Suit, number>;
  roundOneCallCount: number;
  roundOneCallRate: number;
  roundTwoCallCount: number;
  roundTwoCallRate: number;
  passoutCount: number;
  passoutRate: number;
  stickDealerCount: number;
  stickDealerRate: number;
  dealerPickupCount: number;
  dealerPickupRate: number;
  makerHandCount: number;
  makerPointCount: number;
  makerWinRate: number;
  makerEuchreRate: number;
  makerMarchRate: number;
  averageMakerTricks: number;
  averageDefenderTricks: number;
  loneAttemptCount: number;
  loneAttemptRate: number;
  loneSuccessCount: number;
  loneSuccessRate: number;
  loneEuchreCount: number;
  botPolicyName: string;
  botPolicyId: BotPolicyId;
  botPolicyVersion: string;
  botPolicy: BotPolicyMetadata;
  botDifficulty: BotDifficulty;
  targetScore: number;
  stickDealer: boolean;
  invariantMode: "off" | "warn" | "strict";
  seed: number | string;
  blowoutCount: number;
  blowoutRate: number;
  closeGameCount: number;
  closeGameRate: number;
  dealerHandCountBySeat: Record<PlayerIndex, number>;
  handWinRateByDealerSeat: Record<PlayerIndex, number>;
  makerCountBySeat: Record<PlayerIndex, number>;
  makerSuccessRateBySeat: Record<PlayerIndex, number>;
  euchreRateByMakerSeat: Record<PlayerIndex, number>;
  marchRateByMakerSeat: Record<PlayerIndex, number>;
  callerSeatDistribution: Record<PlayerIndex, number>;
  callerRoundDistribution: Record<1 | 2, number>;
  defenderEuchreCount: number;
  defenderEuchreRate: number;
  makerMarchSweepRate: number;
  lonerAttemptsBySeat: Record<PlayerIndex, number>;
  lonerSuccessesBySeat: Record<PlayerIndex, number>;
  lonerEuchresBySeat: Record<PlayerIndex, number>;
  lonerSuccessRateBySeat: Record<PlayerIndex, number>;
}

type MutablePlaytestMetrics = PlaytestMetrics & {
  totalPoints: number;
  totalWinningScore: number;
  totalLosingScore: number;
  blowoutGames: number;
  closeGames: number;
  makerSuccessCount: number;
  makerEuchreCount: number;
  makerMarchCount: number;
  makerTrickCount: number;
  defenderTrickCount: number;
};

const SEATS = [0, 1, 2, 3] as const satisfies PlayerIndex[];
export function createPlaytestMetrics({
  totalGames,
  seed,
  config,
  botPolicy,
  invariantMode
}: {
  totalGames: number;
  seed: number | string;
  config: GameConfig;
  botPolicy: BotPolicyMetadata;
  invariantMode: "off" | "warn" | "strict";
}): MutablePlaytestMetrics {
  return {
    totalGames,
    completedGames: 0,
    failedGames: 0,
    totalHands: 0,
    elapsedMs: 0,
    averageHandsPerGame: 0,
    averagePointsPerHand: 0,
    failureCountByReason: {},
    invariantWarningsByCode: {},
    finalScoreDistribution: {},
    teamWins: [0, 0],
    teamWinRates: [0, 0],
    averageWinningScore: 0,
    averageLosingScore: 0,
    dealerSeatDistribution: seatNumberRecord(0),
    initialDealerGames: seatNumberRecord(0),
    winsByInitialDealer: seatNumberRecord(0),
    winRateByInitialDealer: seatNumberRecord(0),
    handOutcomesByDealerSeat: seatRecord(createDealerSeatMetrics),
    makerOutcomesByMakerSeat: seatRecord(createSeatOutcomeMetrics),
    callerOutcomesByCallerSeat: seatRecord(createSeatOutcomeMetrics),
    trumpSuitDistribution: suitNumberRecord(0),
    upcardSuitDistribution: suitNumberRecord(0),
    roundOneCallCount: 0,
    roundOneCallRate: 0,
    roundTwoCallCount: 0,
    roundTwoCallRate: 0,
    passoutCount: 0,
    passoutRate: 0,
    stickDealerCount: 0,
    stickDealerRate: 0,
    dealerPickupCount: 0,
    dealerPickupRate: 0,
    makerHandCount: 0,
    makerPointCount: 0,
    makerWinRate: 0,
    makerEuchreRate: 0,
    makerMarchRate: 0,
    averageMakerTricks: 0,
    averageDefenderTricks: 0,
    loneAttemptCount: 0,
    loneAttemptRate: 0,
    loneSuccessCount: 0,
    loneSuccessRate: 0,
    loneEuchreCount: 0,
    botPolicyName: botPolicy.name,
    botPolicyId: botPolicy.id,
    botPolicyVersion: botPolicy.version,
    botPolicy,
    botDifficulty: config.botDifficulty,
    targetScore: config.targetScore,
    stickDealer: config.stickDealer,
    invariantMode,
    seed,
    blowoutCount: 0,
    blowoutRate: 0,
    closeGameCount: 0,
    closeGameRate: 0,
    dealerHandCountBySeat: seatNumberRecord(0),
    handWinRateByDealerSeat: seatNumberRecord(0),
    makerCountBySeat: seatNumberRecord(0),
    makerSuccessRateBySeat: seatNumberRecord(0),
    euchreRateByMakerSeat: seatNumberRecord(0),
    marchRateByMakerSeat: seatNumberRecord(0),
    callerSeatDistribution: seatNumberRecord(0),
    callerRoundDistribution: { 1: 0, 2: 0 },
    defenderEuchreCount: 0,
    defenderEuchreRate: 0,
    makerMarchSweepRate: 0,
    lonerAttemptsBySeat: seatNumberRecord(0),
    lonerSuccessesBySeat: seatNumberRecord(0),
    lonerEuchresBySeat: seatNumberRecord(0),
    lonerSuccessRateBySeat: seatNumberRecord(0),
    totalPoints: 0,
    totalWinningScore: 0,
    totalLosingScore: 0,
    blowoutGames: 0,
    closeGames: 0,
    makerSuccessCount: 0,
    makerEuchreCount: 0,
    makerMarchCount: 0,
    makerTrickCount: 0,
    defenderTrickCount: 0
  };
}

export function recordPlaytestHand(metrics: MutablePlaytestMetrics, state: GameState): void {
  metrics.totalHands += 1;
  metrics.dealerSeatDistribution[state.dealer] += 1;
  metrics.dealerHandCountBySeat[state.dealer] += 1;

  if (state.upcard) {
    metrics.upcardSuitDistribution[state.upcard.suit] += 1;
  }

  const orderUp = state.bids.find((bid) => bid.round === 1 && bid.decision === "order-up");
  const roundTwoCall = state.bids.find((bid) => bid.round === 2 && bid.decision === "call");

  if (!state.handResult) {
    metrics.passoutCount += 1;
    return;
  }

  const handPoints = state.handResult.pointsAwarded[0] + state.handResult.pointsAwarded[1];
  metrics.totalPoints += handPoints;
  metrics.makerHandCount += 1;
  metrics.makerPointCount += state.handResult.pointsAwarded[state.handResult.makers];
  metrics.trumpSuitDistribution[state.handResult.trump] += 1;

  if (orderUp) {
    metrics.roundOneCallCount += 1;
    metrics.dealerPickupCount += 1;
    metrics.callerRoundDistribution[1] += 1;
  }
  if (roundTwoCall) {
    metrics.roundTwoCallCount += 1;
    metrics.callerRoundDistribution[2] += 1;
  }
  if (
    roundTwoCall &&
    state.config.stickDealer &&
    roundTwoCall.player === state.dealer &&
    state.bids.filter((bid) => bid.round === 2 && bid.decision === "pass").length >= 3
  ) {
    metrics.stickDealerCount += 1;
  }

  const makerTeam = state.handResult.makers;
  const defenderTeam = makerTeam === 0 ? 1 : 0;
  const makerTricks = state.handResult.tricksWon[makerTeam];
  const defenderTricks = state.handResult.tricksWon[defenderTeam];
  metrics.makerTrickCount += makerTricks;
  metrics.defenderTrickCount += defenderTricks;

  const dealerTeam = teamOf(state.dealer);
  const dealerOutcome = metrics.handOutcomesByDealerSeat[state.dealer];
  dealerOutcome.hands += 1;
  dealerOutcome.dealerTeamPoints += state.handResult.pointsAwarded[dealerTeam];
  if (state.handResult.pointsAwarded[dealerTeam] > 0) {
    dealerOutcome.dealerTeamHandsWon += 1;
  }

  const makerSeat = state.handResult.maker;
  metrics.makerCountBySeat[makerSeat] += 1;
  metrics.callerSeatDistribution[makerSeat] += 1;
  recordSeatOutcome(metrics.makerOutcomesByMakerSeat[makerSeat], state.handResult.euchred, state.handResult.march, state.handResult.pointsAwarded[makerTeam]);
  recordSeatOutcome(metrics.callerOutcomesByCallerSeat[makerSeat], state.handResult.euchred, state.handResult.march, state.handResult.pointsAwarded[makerTeam]);

  if (state.handResult.euchred) {
    metrics.makerEuchreCount += 1;
    metrics.defenderEuchreCount += 1;
    if (state.handResult.lone) {
      metrics.loneEuchreCount += 1;
      metrics.lonerEuchresBySeat[makerSeat] += 1;
    }
  } else {
    metrics.makerSuccessCount += 1;
  }
  if (state.handResult.march) {
    metrics.makerMarchCount += 1;
  }
  if (state.handResult.lone) {
    metrics.loneAttemptCount += 1;
    metrics.lonerAttemptsBySeat[makerSeat] += 1;
    if (state.handResult.march) {
      metrics.loneSuccessCount += 1;
      metrics.lonerSuccessesBySeat[makerSeat] += 1;
    }
  }
}

export function recordCompletedGame(metrics: MutablePlaytestMetrics, state: GameState, initialDealer: PlayerIndex): void {
  const winningTeam = state.scores[0] >= state.config.targetScore ? 0 : 1;
  const losingTeam = winningTeam === 0 ? 1 : 0;

  metrics.completedGames += 1;
  metrics.teamWins[winningTeam] += 1;
  metrics.initialDealerGames[initialDealer] += 1;
  if (teamOf(initialDealer) === winningTeam) {
    metrics.winsByInitialDealer[initialDealer] += 1;
  }
  metrics.totalWinningScore += state.scores[winningTeam];
  metrics.totalLosingScore += state.scores[losingTeam];
  const margin = Math.abs(state.scores[0] - state.scores[1]);
  if (margin >= 5) {
    metrics.blowoutGames += 1;
    metrics.blowoutCount += 1;
  }
  if (margin <= 2) {
    metrics.closeGames += 1;
    metrics.closeGameCount += 1;
  }

  const finalScoreKey = `${state.scores[0]}-${state.scores[1]}`;
  metrics.finalScoreDistribution[finalScoreKey] = (metrics.finalScoreDistribution[finalScoreKey] ?? 0) + 1;
}

export function recordFailedGame(metrics: MutablePlaytestMetrics, reason: string, initialDealer?: PlayerIndex): void {
  metrics.failedGames += 1;
  metrics.failureCountByReason[reason] = (metrics.failureCountByReason[reason] ?? 0) + 1;
  if (initialDealer !== undefined) {
    metrics.initialDealerGames[initialDealer] += 1;
  }
}

export function recordInvariantWarnings(metrics: MutablePlaytestMetrics, codes: string[]): void {
  for (const code of codes) {
    metrics.invariantWarningsByCode[code] = (metrics.invariantWarningsByCode[code] ?? 0) + 1;
  }
}

export function finalizePlaytestMetrics(metrics: MutablePlaytestMetrics, elapsedMs: number): PlaytestMetrics {
  metrics.elapsedMs = elapsedMs;
  metrics.averageHandsPerGame = round(metrics.totalHands / Math.max(1, metrics.completedGames));
  metrics.averagePointsPerHand = round(metrics.totalPoints / Math.max(1, metrics.totalHands - metrics.passoutCount));
  metrics.teamWinRates = [
    round(metrics.teamWins[0] / Math.max(1, metrics.completedGames)),
    round(metrics.teamWins[1] / Math.max(1, metrics.completedGames))
  ];
  metrics.averageWinningScore = round(metrics.totalWinningScore / Math.max(1, metrics.completedGames));
  metrics.averageLosingScore = round(metrics.totalLosingScore / Math.max(1, metrics.completedGames));
  metrics.winRateByInitialDealer = seatNumberRecord(0);
  for (const seat of SEATS) {
    metrics.winRateByInitialDealer[seat] = round(metrics.winsByInitialDealer[seat] / Math.max(1, metrics.initialDealerGames[seat]));
    metrics.handOutcomesByDealerSeat[seat].dealerTeamHandWinRate = round(
      metrics.handOutcomesByDealerSeat[seat].dealerTeamHandsWon / Math.max(1, metrics.handOutcomesByDealerSeat[seat].hands)
    );
    metrics.handWinRateByDealerSeat[seat] = metrics.handOutcomesByDealerSeat[seat].dealerTeamHandWinRate;
    finalizeSeatOutcome(metrics.makerOutcomesByMakerSeat[seat]);
    finalizeSeatOutcome(metrics.callerOutcomesByCallerSeat[seat]);
    metrics.makerSuccessRateBySeat[seat] = metrics.makerOutcomesByMakerSeat[seat].successRate;
    metrics.euchreRateByMakerSeat[seat] = metrics.makerOutcomesByMakerSeat[seat].euchreRate;
    metrics.marchRateByMakerSeat[seat] = metrics.makerOutcomesByMakerSeat[seat].marchRate;
    metrics.lonerSuccessRateBySeat[seat] = round(metrics.lonerSuccessesBySeat[seat] / Math.max(1, metrics.lonerAttemptsBySeat[seat]));
  }

  metrics.roundOneCallRate = round(metrics.roundOneCallCount / Math.max(1, metrics.totalHands));
  metrics.roundTwoCallRate = round(metrics.roundTwoCallCount / Math.max(1, metrics.totalHands));
  metrics.passoutRate = round(metrics.passoutCount / Math.max(1, metrics.totalHands));
  metrics.stickDealerRate = round(metrics.stickDealerCount / Math.max(1, metrics.totalHands));
  metrics.dealerPickupRate = round(metrics.dealerPickupCount / Math.max(1, metrics.totalHands));
  metrics.makerWinRate = round(metrics.makerSuccessCount / Math.max(1, metrics.makerHandCount));
  metrics.makerEuchreRate = round(metrics.makerEuchreCount / Math.max(1, metrics.makerHandCount));
  metrics.makerMarchRate = round(metrics.makerMarchCount / Math.max(1, metrics.makerHandCount));
  metrics.makerMarchSweepRate = metrics.makerMarchRate;
  metrics.defenderEuchreRate = round(metrics.defenderEuchreCount / Math.max(1, metrics.makerHandCount));
  metrics.averageMakerTricks = round(metrics.makerTrickCount / Math.max(1, metrics.makerHandCount));
  metrics.averageDefenderTricks = round(metrics.defenderTrickCount / Math.max(1, metrics.makerHandCount));
  metrics.loneAttemptRate = round(metrics.loneAttemptCount / Math.max(1, metrics.makerHandCount));
  metrics.loneSuccessRate = round(metrics.loneSuccessCount / Math.max(1, metrics.loneAttemptCount));
  metrics.blowoutRate = round(metrics.blowoutGames / Math.max(1, metrics.completedGames));
  metrics.closeGameRate = round(metrics.closeGames / Math.max(1, metrics.completedGames));

  return stripMutable(metrics);
}

function recordSeatOutcome(outcome: SeatOutcomeMetrics, euchred: boolean, march: boolean, points: number): void {
  outcome.hands += 1;
  outcome.points += points;
  if (euchred) {
    outcome.euchres += 1;
  } else {
    outcome.successes += 1;
  }
  if (march) {
    outcome.marches += 1;
  }
}

function finalizeSeatOutcome(outcome: SeatOutcomeMetrics): void {
  outcome.successRate = round(outcome.successes / Math.max(1, outcome.hands));
  outcome.euchreRate = round(outcome.euchres / Math.max(1, outcome.hands));
  outcome.marchRate = round(outcome.marches / Math.max(1, outcome.hands));
}

function createSeatOutcomeMetrics(): SeatOutcomeMetrics {
  return {
    hands: 0,
    successes: 0,
    euchres: 0,
    marches: 0,
    points: 0,
    successRate: 0,
    euchreRate: 0,
    marchRate: 0
  };
}

function createDealerSeatMetrics(): DealerSeatMetrics {
  return {
    hands: 0,
    dealerTeamHandsWon: 0,
    dealerTeamPoints: 0,
    dealerTeamHandWinRate: 0
  };
}

function seatNumberRecord(value: number): Record<PlayerIndex, number> {
  return {
    0: value,
    1: value,
    2: value,
    3: value
  };
}

function suitNumberRecord(value: number): Record<Suit, number> {
  return {
    clubs: value,
    diamonds: value,
    hearts: value,
    spades: value
  };
}

function seatRecord<T>(factory: () => T): Record<PlayerIndex, T> {
  return {
    0: factory(),
    1: factory(),
    2: factory(),
    3: factory()
  };
}

function stripMutable(metrics: MutablePlaytestMetrics): PlaytestMetrics {
  const publicMetrics = { ...metrics } as Partial<MutablePlaytestMetrics>;
  delete publicMetrics.totalPoints;
  delete publicMetrics.totalWinningScore;
  delete publicMetrics.totalLosingScore;
  delete publicMetrics.blowoutGames;
  delete publicMetrics.closeGames;
  delete publicMetrics.makerSuccessCount;
  delete publicMetrics.makerEuchreCount;
  delete publicMetrics.makerMarchCount;
  delete publicMetrics.makerTrickCount;
  delete publicMetrics.defenderTrickCount;

  return publicMetrics as PlaytestMetrics;
}

function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

export function scoringTeam(pointsAwarded: [number, number]): TeamIndex | null {
  if (pointsAwarded[0] > 0) return 0;
  if (pointsAwarded[1] > 0) return 1;
  return null;
}
