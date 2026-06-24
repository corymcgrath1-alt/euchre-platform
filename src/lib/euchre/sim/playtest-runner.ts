import { seededRandom } from "../deck";
import { createInitialGameState, dispatchAction, normalizeGameConfig } from "../engine";
import {
  DEFAULT_BOT_POLICY_ID,
  assertBotPolicyId,
  getBotPolicy,
  type BotPolicy,
  type BotPolicyId,
  type BotPolicyMetadata
} from "../bot-policies";
import type { BotProfile } from "../bots";
import type { BotDifficulty, FarmersHandMode, GameAction, GameState, LonerMode, PlayerIndex } from "../types";
import { buildPlaytestFailure, type PlaytestFailure } from "./failure-log";
import {
  checkGameInvariants,
  invariantErrorCodes,
  invariantWarningCodes,
  type InvariantViolation
} from "./invariants";
import {
  createPlaytestMetrics,
  finalizePlaytestMetrics,
  recordCompletedGame,
  recordFailedGame,
  recordInvariantWarnings,
  recordPlaytestHand,
  type PlaytestMetrics
} from "./playtest-metrics";

export type InvariantMode = "off" | "warn" | "strict";

export type PlaytestConfig = {
  games: number;
  seed: number | string;
  targetScore: number;
  stickDealer: boolean;
  invariants: InvariantMode;
  botPolicy?: BotPolicyId | string;
  botDifficulty?: BotDifficulty;
  farmersHandMode?: FarmersHandMode;
  lonerMode?: LonerMode;
  sampleReviews?: number;
  failFast?: boolean;
};

export type NormalizedPlaytestConfig = Required<Omit<PlaytestConfig, "botPolicy" | "sampleReviews" | "failFast">> & {
  botPolicy: BotPolicyId;
  sampleReviews: number;
  failFast: boolean;
};

export type PlaytestSummary = {
  config: NormalizedPlaytestConfig;
  totalGames: number;
  completedGames: number;
  failedGames: number;
  totalHands: number;
  elapsedMs: number;
  botPolicy: BotPolicyMetadata;
  comparison: PlaytestComparison;
  metrics: PlaytestMetrics;
  failures: PlaytestFailure[];
};

export type PlaytestComparison = {
  botPolicy: BotPolicyId;
  botPolicyVersion: string;
  games: number;
  completedGames: number;
  failedGames: number;
  averageHandsPerGame: number;
  teamWinRates: {
    northSouth: number;
    eastWest: number;
  };
  makerWinRate: number;
  euchreRate: number;
  marchRate: number;
  loneAttemptRate: number;
  loneSuccessRate: number;
  roundOneCallRate: number;
  roundTwoCallRate: number;
  stickDealerRate: number;
  blowoutRate: number;
  closeGameRate: number;
};

class InvariantFailure extends Error {
  constructor(readonly violations: InvariantViolation[]) {
    super(`Invariant check failed: ${invariantErrorCodes(violations).join(", ")}`);
    this.name = "InvariantFailure";
  }
}

const MAX_ACTIONS_PER_GAME = 2_000;

export async function runPlaytest(input: PlaytestConfig): Promise<PlaytestSummary> {
  const config = normalizePlaytestConfig(input);
  const botPolicy = getBotPolicy(config.botPolicy);
  const gameConfig = normalizeGameConfig({
    targetScore: config.targetScore,
    stickDealer: config.stickDealer,
    botDifficulty: config.botDifficulty,
    farmersHandMode: config.farmersHandMode,
    lonerMode: config.lonerMode
  });
  const started = Date.now();
  const metrics = createPlaytestMetrics({
    totalGames: config.games,
    seed: config.seed,
    config: gameConfig,
    botPolicy: botPolicy.metadata,
    invariantMode: config.invariants
  });
  const failures: PlaytestFailure[] = [];

  for (let gameIndex = 0; gameIndex < config.games; gameIndex += 1) {
    const gameStarted = Date.now();
    const gameSeed = deriveGameSeed(config.seed, gameIndex);
    const random = seededRandom(gameSeed);
    let state = createInitialGameState(gameConfig);
    const initialDealer = state.dealer;
    let completedHandsForGame = 0;
    let guard = 0;
    let lastActionAttempted: GameAction | undefined;
    let lastSuccessfulAction: GameAction | undefined;
    const warningKeys = new Set<string>();

    try {
      checkInvariantsForMode({
        mode: config.invariants,
        metrics,
        warningKeys,
        state,
        gameIndex,
        gameSeed
      });

      while (state.phase !== "gameComplete" && guard < MAX_ACTIONS_PER_GAME) {
        guard += 1;
        const action = nextPlaytestAction(state, random, botPolicy);
        if (!action) {
          throw new Error(`No legal simulation action for ${state.phase} player ${state.activePlayer}`);
        }

        const previousScores: [number, number] = [...state.scores];
        lastActionAttempted = action;
        const nextState = dispatchAction(state, action);
        lastSuccessfulAction = action;
        state = nextState;

        checkInvariantsForMode({
          mode: config.invariants,
          metrics,
          warningKeys,
          state,
          gameIndex,
          gameSeed,
          lastAction: action,
          previousScores
        });

        if ((state.phase === "handComplete" || state.phase === "gameComplete") && state.handNumber > completedHandsForGame) {
          recordPlaytestHand(metrics, state);
          completedHandsForGame += 1;
          checkInvariantsForMode({
            mode: config.invariants,
            metrics,
            warningKeys,
            state,
            gameIndex,
            gameSeed,
            lastAction: action,
            previousScores
          });
        }
      }

      if (guard >= MAX_ACTIONS_PER_GAME) {
        throw new Error("Simulation guard exceeded");
      }

      checkInvariantsForMode({
        mode: config.invariants,
        metrics,
        warningKeys,
        state,
        gameIndex,
        gameSeed,
        lastAction: lastSuccessfulAction
      });
      recordCompletedGame(metrics, state, initialDealer);
    } catch (error) {
      const violations = error instanceof InvariantFailure ? error.violations : [];
      const failure = buildPlaytestFailure({
        gameIndex,
        seed: config.seed,
        gameSeed,
        botPolicy: config.botPolicy,
        botPolicyMetadata: botPolicy.metadata,
        config: gameConfig,
        state,
        error,
        invariantViolations: violations,
        lastActionAttempted,
        lastSuccessfulAction,
        elapsedMs: Date.now() - gameStarted
      });
      failures.push(failure);
      recordFailedGame(metrics, failure.reason, initialDealer);

      if (config.failFast) {
        break;
      }
    }
  }

  const elapsedMs = Date.now() - started;
  const finalizedMetrics = finalizePlaytestMetrics(metrics, elapsedMs);

  return {
    config,
    totalGames: config.games,
    completedGames: finalizedMetrics.completedGames,
    failedGames: finalizedMetrics.failedGames,
    totalHands: finalizedMetrics.totalHands,
    elapsedMs,
    botPolicy: botPolicy.metadata,
    comparison: buildComparison(finalizedMetrics, botPolicy.metadata),
    metrics: finalizedMetrics,
    failures
  };
}

export function normalizePlaytestConfig(input: PlaytestConfig): NormalizedPlaytestConfig {
  return {
    games: positiveInteger(input.games, "games"),
    seed: input.seed,
    targetScore: positiveInteger(input.targetScore, "targetScore"),
    stickDealer: Boolean(input.stickDealer),
    invariants: normalizeInvariantMode(input.invariants),
    botPolicy: assertBotPolicyId(String(input.botPolicy ?? DEFAULT_BOT_POLICY_ID)),
    botDifficulty: input.botDifficulty ?? "standard",
    farmersHandMode: input.farmersHandMode ?? "off",
    lonerMode: input.lonerMode ?? "aloneOnly",
    sampleReviews: Math.max(0, Math.floor(input.sampleReviews ?? 0)),
    failFast: Boolean(input.failFast)
  };
}

function nextPlaytestAction(state: GameState, random: () => number, botPolicy: BotPolicy): GameAction | null {
  if (state.phase === "idle") {
    return { type: "START_HAND", seed: nextActionSeed(random) };
  }

  if (state.phase === "handComplete") {
    return { type: "NEXT_HAND", seed: nextActionSeed(random) };
  }

  return botPolicy.chooseAction(state, simulationBot(state.activePlayer), {
    random,
    nextSeed: () => nextActionSeed(random)
  });
}

function simulationBot(seat: PlayerIndex): BotProfile {
  return {
    id: `playtest-seat-${seat}`,
    name: `Seat ${seat} Bot`,
    seat,
    enabled: true
  };
}

function nextActionSeed(random: () => number): number {
  return Math.floor(random() * 1_000_000_000);
}

function buildComparison(metrics: PlaytestMetrics, botPolicy: BotPolicyMetadata): PlaytestComparison {
  return {
    botPolicy: botPolicy.id,
    botPolicyVersion: botPolicy.version,
    games: metrics.totalGames,
    completedGames: metrics.completedGames,
    failedGames: metrics.failedGames,
    averageHandsPerGame: metrics.averageHandsPerGame,
    teamWinRates: {
      northSouth: metrics.teamWinRates[0],
      eastWest: metrics.teamWinRates[1]
    },
    makerWinRate: metrics.makerWinRate,
    euchreRate: metrics.makerEuchreRate,
    marchRate: metrics.makerMarchRate,
    loneAttemptRate: metrics.loneAttemptRate,
    loneSuccessRate: metrics.loneSuccessRate,
    roundOneCallRate: metrics.roundOneCallRate,
    roundTwoCallRate: metrics.roundTwoCallRate,
    stickDealerRate: metrics.stickDealerRate,
    blowoutRate: metrics.blowoutRate,
    closeGameRate: metrics.closeGameRate
  };
}

export function deriveGameSeed(seed: number | string, gameIndex: number): number {
  const base = typeof seed === "number" ? seed >>> 0 : hashStringSeed(seed);
  return (base ^ Math.imul(gameIndex + 1, 0x9e3779b1)) >>> 0;
}

function checkInvariantsForMode({
  mode,
  metrics,
  warningKeys,
  state,
  gameIndex,
  gameSeed,
  lastAction,
  previousScores
}: {
  mode: InvariantMode;
  metrics: Parameters<typeof recordInvariantWarnings>[0];
  warningKeys: Set<string>;
  state: GameState;
  gameIndex: number;
  gameSeed: number;
  lastAction?: GameAction;
  previousScores?: [number, number];
}): void {
  if (mode === "off") {
    return;
  }

  const violations = checkGameInvariants(state, {
    gameIndex,
    handNumber: state.handNumber,
    phase: state.phase,
    lastAction,
    previousScores,
    strict: mode === "strict"
  });
  const warnings = invariantWarningCodes(violations).filter((code) => {
    const key = `${gameIndex}:${state.handNumber}:${code}`;
    if (warningKeys.has(key)) {
      return false;
    }
    warningKeys.add(key);
    return true;
  });
  recordInvariantWarnings(metrics, warnings);

  if (mode === "strict" && invariantErrorCodes(violations).length > 0) {
    throw new InvariantFailure(violations);
  }

  void gameSeed;
}

function normalizeInvariantMode(mode: InvariantMode): InvariantMode {
  if (mode === "off" || mode === "warn" || mode === "strict") {
    return mode;
  }
  throw new Error(`Invalid invariant mode: ${String(mode)}`);
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function hashStringSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function winningTeamFromState(state: GameState): 0 | 1 | undefined {
  if (state.scores[0] >= state.config.targetScore) return 0;
  if (state.scores[1] >= state.config.targetScore) return 1;
  return undefined;
}

export function initialDealerForState(state: GameState): PlayerIndex {
  return state.dealer;
}
