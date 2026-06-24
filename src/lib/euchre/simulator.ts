import { chooseBotAction, type BotProfile } from "./bots";
import { cardLabel } from "./cards";
import { seededRandom, teamOf } from "./deck";
import { createInitialGameState, dispatchAction, normalizeGameConfig } from "./engine";
import { legalActionsForPlayer } from "./rules";
import type { GameAction, GameConfig, GameState, PlayerIndex, Suit, TeamIndex } from "./types";

export interface SimulationInput {
  games: number;
  seed: number;
  config?: Partial<GameConfig>;
}

export interface SimulationConfigSnapshot extends GameConfig {
  games: number;
  seed: number;
}

export interface SimulationMetrics {
  totalGames: number;
  totalHands: number;
  runtimeMs: number;
  averageHandsPerGame: number;
  averagePointsPerHand: number;
  teamWins: [number, number];
  teamWinRates: [number, number];
  winsByInitialDealerSeat: Record<PlayerIndex, number>;
  dealerTeamHandsWon: number;
  dealerTeamHandWinRate: number;
  makerHands: number;
  makerSuccesses: number;
  makerSuccessRate: number;
  makerEuchred: number;
  makerEuchredRate: number;
  roundOneCallRate: number;
  roundTwoCallRate: number;
  passoutRate: number;
  stickDealerForcedCallRate: number;
  trumpSuitDistribution: Record<Suit, number>;
  upcardSuitDistribution: Record<Suit, number>;
  dealerPickupRate: number;
  lonerAttemptRate: number;
  lonerSuccessRate: number;
  marchRate: number;
  euchreRate: number;
  averageMakerTricks: number;
  averageDefenderTricks: number;
  finalScoreDistribution: Record<string, number>;
  handScoreDistribution: {
    onePoint: number;
    twoPointMarch: number;
    fourPointLoner: number;
    twoPointEuchre: number;
    passout: number;
  };
  illegalMoveCount: number;
  failedGames: number;
  botDecisionCounts: {
    passes: number;
    orderUps: number;
    calls: number;
    lonerCalls: number;
    discards: number;
    cardPlays: number;
    nextHands: number;
    startHands: number;
    farmersHandActions: number;
  };
}

export interface SimulationGameRecord {
  gameIndex: number;
  initialDealer: PlayerIndex;
  winningTeam?: TeamIndex;
  finalScore: [number, number];
  hands: number;
  failed: boolean;
}

export interface SimulationHandRecord {
  gameIndex: number;
  handNumber: number;
  dealer: PlayerIndex;
  upcard?: string;
  trump?: Suit;
  maker?: PlayerIndex;
  makerTeam?: TeamIndex;
  pointsAwarded: [number, number];
  tricksWon: [number, number];
  round: 1 | 2 | "passout";
  loner: boolean;
  lonerSucceeded: boolean;
  march: boolean;
  euchred: boolean;
  passout: boolean;
}

export interface SimulationReport {
  config: SimulationConfigSnapshot;
  metrics: SimulationMetrics;
  games: SimulationGameRecord[];
  hands: SimulationHandRecord[];
}

type MetricAccumulator = Omit<SimulationMetrics, "runtimeMs" | "averageHandsPerGame" | "averagePointsPerHand" | "teamWinRates" | "dealerTeamHandWinRate" | "makerSuccessRate" | "makerEuchredRate" | "roundOneCallRate" | "roundTwoCallRate" | "passoutRate" | "stickDealerForcedCallRate" | "dealerPickupRate" | "lonerAttemptRate" | "lonerSuccessRate" | "marchRate" | "euchreRate" | "averageMakerTricks" | "averageDefenderTricks"> & {
  totalPoints: number;
  roundOneCalls: number;
  roundTwoCalls: number;
  passouts: number;
  stickDealerForcedCalls: number;
  dealerPickups: number;
  lonerAttempts: number;
  lonerSuccesses: number;
  marches: number;
  euchres: number;
  makerTricks: number;
  defenderTricks: number;
};

const ALL_SEATS = [0, 1, 2, 3] as const satisfies PlayerIndex[];
const ALL_SUITS = ["clubs", "diamonds", "hearts", "spades"] as const satisfies Suit[];

export function simulateEuchreGames(input: SimulationInput): SimulationReport {
  const config = normalizeGameConfig(input.config);
  const random = seededRandom(input.seed);
  const metrics = createMetricAccumulator(input.games);
  const games: SimulationGameRecord[] = [];
  const hands: SimulationHandRecord[] = [];

  for (let gameIndex = 0; gameIndex < input.games; gameIndex += 1) {
    let state = createInitialGameState(config);
    const initialDealer = state.dealer;
    let failed = false;
    let guard = 0;
    let completedHandsForGame = 0;

    try {
      while (state.phase !== "gameComplete" && guard < 2_000) {
        guard += 1;
        const action = nextSimulationAction(state, random);
        if (!action) {
          throw new Error(`No legal simulation action for ${state.phase} player ${state.activePlayer}`);
        }

        countAction(metrics, state, action);
        const nextState = dispatchAction(state, action);
        if ((nextState.phase === "handComplete" || nextState.phase === "gameComplete") && nextState.handNumber > completedHandsForGame) {
          const hand = summarizeHand(gameIndex, nextState);
          hands.push(hand);
          completedHandsForGame += 1;
          countHand(metrics, hand, nextState);
        }
        state = nextState;
      }

      if (guard >= 2_000) {
        throw new Error("Simulation guard exceeded");
      }
    } catch {
      failed = true;
      metrics.failedGames += 1;
      metrics.illegalMoveCount += 1;
    }

    const winningTeam = state.scores[0] >= state.config.targetScore ? 0 : state.scores[1] >= state.config.targetScore ? 1 : undefined;
    if (winningTeam !== undefined) {
      metrics.teamWins[winningTeam] += 1;
      metrics.winsByInitialDealerSeat[initialDealer] += 1;
    }
    games.push({
      gameIndex,
      initialDealer,
      winningTeam,
      finalScore: [...state.scores],
      hands: state.handNumber,
      failed
    });
    const finalScoreKey = `${state.scores[0]}-${state.scores[1]}`;
    metrics.finalScoreDistribution[finalScoreKey] = (metrics.finalScoreDistribution[finalScoreKey] ?? 0) + 1;
  }

  return {
    config: {
      ...config,
      games: input.games,
      seed: input.seed
    },
    metrics: finalizeMetrics(metrics, 0),
    games,
    hands
  };
}

export function nextSimulationAction(state: GameState, random = seededRandom(1)): GameAction | null {
  if (state.phase === "idle") {
    return { type: "START_HAND", seed: nextSeed(random) };
  }

  if (state.phase === "handComplete") {
    return { type: "NEXT_HAND", seed: nextSeed(random) };
  }

  const bot = simulationBot(state.activePlayer);
  const action = chooseBotAction(state, bot, state.config.botDifficulty);
  if (action) {
    return action;
  }

  const legal = legalActionsForPlayer(state, state.activePlayer);
  if (state.phase === "farmersHand") {
    return legal.canDeclineFarmersHand ? { type: "FARMERS_HAND_DECLINE", player: state.activePlayer } : null;
  }
  if (state.phase === "discarding") {
    const card = legal.mustDiscard ? state.hands[state.activePlayer][0] : undefined;
    return card ? { type: "DISCARD", player: state.activePlayer, card } : null;
  }
  if (state.phase === "playing") {
    const card = legal.playableCards[0];
    return card ? { type: "PLAY_CARD", player: state.activePlayer, card } : null;
  }

  return null;
}

export function simulationReportToCsv(report: SimulationReport): string {
  const header = [
    "gameIndex",
    "handNumber",
    "dealer",
    "upcard",
    "trump",
    "maker",
    "makerTeam",
    "team0Points",
    "team1Points",
    "team0Tricks",
    "team1Tricks",
    "round",
    "loner",
    "lonerSucceeded",
    "march",
    "euchred",
    "passout"
  ];
  const rows = report.hands.map((hand) => [
    hand.gameIndex,
    hand.handNumber,
    hand.dealer,
    hand.upcard ?? "",
    hand.trump ?? "",
    hand.maker ?? "",
    hand.makerTeam ?? "",
    hand.pointsAwarded[0],
    hand.pointsAwarded[1],
    hand.tricksWon[0],
    hand.tricksWon[1],
    hand.round,
    hand.loner,
    hand.lonerSucceeded,
    hand.march,
    hand.euchred,
    hand.passout
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function createMetricAccumulator(totalGames: number): MetricAccumulator {
  return {
    totalGames,
    totalHands: 0,
    teamWins: [0, 0],
    winsByInitialDealerSeat: { 0: 0, 1: 0, 2: 0, 3: 0 },
    dealerTeamHandsWon: 0,
    makerHands: 0,
    makerSuccesses: 0,
    makerEuchred: 0,
    trumpSuitDistribution: { clubs: 0, diamonds: 0, hearts: 0, spades: 0 },
    upcardSuitDistribution: { clubs: 0, diamonds: 0, hearts: 0, spades: 0 },
    finalScoreDistribution: {},
    handScoreDistribution: {
      onePoint: 0,
      twoPointMarch: 0,
      fourPointLoner: 0,
      twoPointEuchre: 0,
      passout: 0
    },
    illegalMoveCount: 0,
    failedGames: 0,
    botDecisionCounts: {
      passes: 0,
      orderUps: 0,
      calls: 0,
      lonerCalls: 0,
      discards: 0,
      cardPlays: 0,
      nextHands: 0,
      startHands: 0,
      farmersHandActions: 0
    },
    totalPoints: 0,
    roundOneCalls: 0,
    roundTwoCalls: 0,
    passouts: 0,
    stickDealerForcedCalls: 0,
    dealerPickups: 0,
    lonerAttempts: 0,
    lonerSuccesses: 0,
    marches: 0,
    euchres: 0,
    makerTricks: 0,
    defenderTricks: 0
  };
}

function finalizeMetrics(metrics: MetricAccumulator, runtimeMs: number): SimulationMetrics {
  return {
    ...metrics,
    runtimeMs,
    averageHandsPerGame: round(metrics.totalHands / Math.max(1, metrics.totalGames)),
    averagePointsPerHand: round(metrics.totalPoints / Math.max(1, metrics.totalHands)),
    teamWinRates: [
      round(metrics.teamWins[0] / Math.max(1, metrics.totalGames)),
      round(metrics.teamWins[1] / Math.max(1, metrics.totalGames))
    ],
    dealerTeamHandWinRate: round(metrics.dealerTeamHandsWon / Math.max(1, metrics.totalHands)),
    makerSuccessRate: round(metrics.makerSuccesses / Math.max(1, metrics.makerHands)),
    makerEuchredRate: round(metrics.makerEuchred / Math.max(1, metrics.makerHands)),
    roundOneCallRate: round(metrics.roundOneCalls / Math.max(1, metrics.totalHands)),
    roundTwoCallRate: round(metrics.roundTwoCalls / Math.max(1, metrics.totalHands)),
    passoutRate: round(metrics.passouts / Math.max(1, metrics.totalHands)),
    stickDealerForcedCallRate: round(metrics.stickDealerForcedCalls / Math.max(1, metrics.totalHands)),
    dealerPickupRate: round(metrics.dealerPickups / Math.max(1, metrics.totalHands)),
    lonerAttemptRate: round(metrics.lonerAttempts / Math.max(1, metrics.totalHands)),
    lonerSuccessRate: round(metrics.lonerSuccesses / Math.max(1, metrics.lonerAttempts)),
    marchRate: round(metrics.marches / Math.max(1, metrics.totalHands)),
    euchreRate: round(metrics.euchres / Math.max(1, metrics.totalHands)),
    averageMakerTricks: round(metrics.makerTricks / Math.max(1, metrics.makerHands)),
    averageDefenderTricks: round(metrics.defenderTricks / Math.max(1, metrics.makerHands))
  };
}

function summarizeHand(gameIndex: number, state: GameState): SimulationHandRecord {
  const orderUp = state.bids.find((bid) => bid.round === 1 && bid.decision === "order-up");
  const call = state.bids.find((bid) => bid.round === 2 && bid.decision === "call");
  const passout = !state.handResult;

  return {
    gameIndex,
    handNumber: state.handNumber,
    dealer: state.dealer,
    upcard: state.upcard ? cardLabel(state.upcard) : undefined,
    trump: state.handResult?.trump ?? state.trump,
    maker: state.handResult?.maker,
    makerTeam: state.handResult?.makers,
    pointsAwarded: state.handResult ? [...state.handResult.pointsAwarded] : [0, 0],
    tricksWon: state.handResult ? [...state.handResult.tricksWon] : [0, 0],
    round: passout ? "passout" : orderUp ? 1 : call ? 2 : "passout",
    loner: Boolean(state.handResult?.lone),
    lonerSucceeded: Boolean(state.handResult?.lone && state.handResult.march),
    march: Boolean(state.handResult?.march),
    euchred: Boolean(state.handResult?.euchred),
    passout
  };
}

function countHand(metrics: MetricAccumulator, hand: SimulationHandRecord, state: GameState): void {
  metrics.totalHands += 1;
  metrics.totalPoints += hand.pointsAwarded[0] + hand.pointsAwarded[1];
  if (state.upcard) {
    metrics.upcardSuitDistribution[state.upcard.suit] += 1;
  }

  if (hand.passout) {
    metrics.passouts += 1;
    metrics.handScoreDistribution.passout += 1;
    return;
  }

  if (hand.trump) {
    metrics.trumpSuitDistribution[hand.trump] += 1;
  }
  if (hand.round === 1) {
    metrics.roundOneCalls += 1;
    metrics.dealerPickups += 1;
  }
  if (hand.round === 2) {
    metrics.roundTwoCalls += 1;
  }
  if (state.config.stickDealer && hand.round === 2 && hand.maker === state.dealer && state.bids.filter((bid) => bid.round === 2 && bid.decision === "pass").length >= 3) {
    metrics.stickDealerForcedCalls += 1;
  }
  if (hand.makerTeam !== undefined) {
    metrics.makerHands += 1;
    const makerTricks = hand.tricksWon[hand.makerTeam];
    const defenderTricks = hand.tricksWon[hand.makerTeam === 0 ? 1 : 0];
    metrics.makerTricks += makerTricks;
    metrics.defenderTricks += defenderTricks;
    if (teamOf(state.dealer) === hand.pointsAwarded.indexOf(Math.max(...hand.pointsAwarded))) {
      metrics.dealerTeamHandsWon += 1;
    }
  }
  if (hand.euchred) {
    metrics.makerEuchred += 1;
    metrics.euchres += 1;
    metrics.handScoreDistribution.twoPointEuchre += 1;
  } else {
    metrics.makerSuccesses += 1;
  }
  if (hand.march) {
    metrics.marches += 1;
    if (hand.lonerSucceeded) {
      metrics.handScoreDistribution.fourPointLoner += 1;
    } else {
      metrics.handScoreDistribution.twoPointMarch += 1;
    }
  } else if (!hand.euchred) {
    metrics.handScoreDistribution.onePoint += 1;
  }
  if (hand.loner) {
    metrics.lonerAttempts += 1;
  }
  if (hand.lonerSucceeded) {
    metrics.lonerSuccesses += 1;
  }
}

function countAction(metrics: MetricAccumulator, state: GameState, action: GameAction): void {
  switch (action.type) {
    case "START_HAND":
      metrics.botDecisionCounts.startHands += 1;
      break;
    case "NEXT_HAND":
      metrics.botDecisionCounts.nextHands += 1;
      break;
    case "PASS":
      metrics.botDecisionCounts.passes += 1;
      break;
    case "ORDER_UP":
      metrics.botDecisionCounts.orderUps += 1;
      if (action.alone) metrics.botDecisionCounts.lonerCalls += 1;
      break;
    case "CALL_TRUMP":
      metrics.botDecisionCounts.calls += 1;
      if (action.alone) metrics.botDecisionCounts.lonerCalls += 1;
      break;
    case "DISCARD":
      metrics.botDecisionCounts.discards += 1;
      break;
    case "PLAY_CARD":
      metrics.botDecisionCounts.cardPlays += 1;
      break;
    case "FARMERS_HAND_DECLINE":
    case "FARMERS_HAND_REDEAL":
    case "FARMERS_HAND_REPLACE":
      metrics.botDecisionCounts.farmersHandActions += 1;
      break;
    case "RESET_GAME":
      break;
    default:
      action satisfies never;
  }

  if (state.phase === "calling" && state.config.stickDealer && action.type === "CALL_TRUMP" && action.player === state.dealer && state.bids.filter((bid) => bid.round === 2 && bid.decision === "pass").length >= 3) {
    metrics.stickDealerForcedCalls += 0;
  }
}

function simulationBot(seat: PlayerIndex): BotProfile {
  return {
    id: `sim-seat-${seat}`,
    name: `Seat ${seat} Bot`,
    seat,
    enabled: true
  };
}

function nextSeed(random: () => number): number {
  return Math.floor(random() * 1_000_000_000);
}

function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function csvCell(value: unknown): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

export function suitKeys(): Suit[] {
  return [...ALL_SUITS];
}

export function seatKeys(): PlayerIndex[] {
  return [...ALL_SEATS];
}
