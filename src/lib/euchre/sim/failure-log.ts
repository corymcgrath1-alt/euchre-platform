import { cardId } from "../cards";
import type { GameAction, GameConfig, GameState, MoveEvent } from "../types";
import type { BotPolicyId, BotPolicyMetadata } from "../bot-policies";
import type { InvariantViolation } from "./invariants";

export interface CompactStateSummary {
  score: [number, number];
  phase: string;
  handNumber: number;
  dealer: number;
  activePlayer: number;
  trump?: string;
  upcard?: string;
  maker?: number;
  lonePlayer?: number;
  currentTrick: {
    leader?: number;
    plays: Array<{ player: number; card: string }>;
  } | null;
  handSizes: Record<string, number>;
  kittySize: number;
  completedTrickCount: number;
}

export interface MoveLogTailRecord {
  sequence: number;
  player?: number;
  action: GameAction;
}

export interface PlaytestFailure {
  gameIndex: number;
  seed: number | string;
  gameSeed: number;
  botPolicy: BotPolicyId;
  botPolicyMetadata: BotPolicyMetadata;
  config: Partial<GameConfig>;
  phase: string;
  handNumber: number;
  dealer: number;
  activePlayer: number;
  lastActionAttempted?: GameAction;
  lastSuccessfulAction?: GameAction;
  reason: string;
  errorMessage: string;
  stack?: string;
  invariantViolations: InvariantViolation[];
  moveLogTail: MoveLogTailRecord[];
  state: CompactStateSummary;
  elapsedMs?: number;
}

export interface BuildPlaytestFailureInput {
  gameIndex: number;
  seed: number | string;
  gameSeed: number;
  botPolicy: BotPolicyId;
  botPolicyMetadata: BotPolicyMetadata;
  config: Partial<GameConfig>;
  state: GameState;
  error?: unknown;
  invariantViolations?: InvariantViolation[];
  lastActionAttempted?: GameAction;
  lastSuccessfulAction?: GameAction;
  elapsedMs?: number;
  moveLogTailSize?: number;
}

export function buildPlaytestFailure(input: BuildPlaytestFailureInput): PlaytestFailure {
  const error = normalizeError(input.error);
  const invariantErrors = (input.invariantViolations ?? []).filter((violation) => violation.severity === "error");
  const reason = invariantErrors[0]?.code ?? error.name ?? "playtest-failure";

  return {
    gameIndex: input.gameIndex,
    seed: input.seed,
    gameSeed: input.gameSeed,
    botPolicy: input.botPolicy,
    botPolicyMetadata: input.botPolicyMetadata,
    config: input.config,
    phase: input.state.phase,
    handNumber: input.state.handNumber,
    dealer: input.state.dealer,
    activePlayer: input.state.activePlayer,
    lastActionAttempted: input.lastActionAttempted,
    lastSuccessfulAction: input.lastSuccessfulAction,
    reason,
    errorMessage: error.message,
    stack: error.stack,
    invariantViolations: input.invariantViolations ?? [],
    moveLogTail: moveLogTail(input.state.moveLog, input.moveLogTailSize ?? 30),
    state: compactStateSummary(input.state),
    elapsedMs: input.elapsedMs
  };
}

export function failureToJsonLine(failure: PlaytestFailure): string {
  return JSON.stringify(failure);
}

export function failuresToJsonl(failures: PlaytestFailure[]): string {
  return failures.map(failureToJsonLine).join("\n");
}

export function compactStateSummary(state: GameState): CompactStateSummary {
  return {
    score: [...state.scores],
    phase: state.phase,
    handNumber: state.handNumber,
    dealer: state.dealer,
    activePlayer: state.activePlayer,
    trump: state.trump,
    upcard: state.upcard ? cardId(state.upcard) : undefined,
    maker: state.maker,
    lonePlayer: state.lonePlayer,
    currentTrick: state.currentTrick
      ? {
          leader: state.currentTrick.leader,
          plays: state.currentTrick.plays.map((play) => ({
            player: play.player,
            card: cardId(play.card)
          }))
        }
      : null,
    handSizes: {
      "0": state.hands[0].length,
      "1": state.hands[1].length,
      "2": state.hands[2].length,
      "3": state.hands[3].length
    },
    kittySize: state.kitty.length,
    completedTrickCount: state.completedTricks.length
  };
}

function moveLogTail(moveLog: MoveEvent[], size: number): MoveLogTailRecord[] {
  return moveLog.slice(-size).map((event) => ({
    sequence: event.sequence,
    player: event.player,
    action: event.action
  }));
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message,
      stack: error.stack
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error
    };
  }

  return {
    name: "Error",
    message: "Unknown playtest failure"
  };
}
