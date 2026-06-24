import { cardLabel } from "./cards";
import { TABLE_PLAYER_NAMES, type CurrentTrickView } from "./table-view";
import type { PlayerIndex } from "./types";

export type TrickAnimationPhase = "empty" | "placing" | "settled" | "winner" | "collecting";
export type TrickSlot = "south-slot" | "west-slot" | "north-slot" | "east-slot";
export type TrickCollectTarget = "south-pile" | "west-pile" | "north-pile" | "east-pile";

export interface TrickAnimationCard {
  seat: PlayerIndex;
  cardLabel: string;
  slot: TrickSlot;
  isWinningCard: boolean;
  playOrder: number;
  animationDelayMs: number;
}

export interface TrickWinnerPresentation {
  winnerSeat?: PlayerIndex;
  winnerLabel?: string;
  winningCardLabel?: string;
  nextLeaderSeat?: PlayerIndex;
  nextLeaderLabel?: string;
  summaryText: string;
}

export interface TrickAnimationState {
  phase: TrickAnimationPhase;
  cards: TrickAnimationCard[];
  collectTarget?: TrickCollectTarget;
  winner: TrickWinnerPresentation;
  placementDurationMs: number;
  winnerPauseMs: number;
  collectionDurationMs: number;
  reducedMotionSafe: boolean;
}

export function getSeatTrickSlot(seat: PlayerIndex): TrickSlot {
  const slots: Record<PlayerIndex, TrickSlot> = {
    0: "south-slot",
    1: "west-slot",
    2: "north-slot",
    3: "east-slot"
  };

  return slots[seat];
}

export function getTrickCollectTarget(seat: PlayerIndex): TrickCollectTarget {
  const targets: Record<PlayerIndex, TrickCollectTarget> = {
    0: "south-pile",
    1: "west-pile",
    2: "north-pile",
    3: "east-pile"
  };

  return targets[seat];
}

export function getTrickWinnerPresentation(trick: CurrentTrickView): TrickWinnerPresentation {
  const winnerLabel = trick.currentWinnerLabel;
  const winningCardLabel = trick.winningCardLabel;
  const nextLeaderLabel = trick.nextLeaderLabel ?? winnerLabel;

  if (!winnerLabel) {
    return {
      nextLeaderSeat: trick.nextLeaderSeat,
      nextLeaderLabel,
      summaryText: trick.plays.length ? "Trick in progress" : `Lead ${trick.leaderLabel}`
    };
  }

  return {
    winnerSeat: trick.currentWinnerSeat,
    winnerLabel,
    winningCardLabel,
    nextLeaderSeat: trick.nextLeaderSeat ?? trick.currentWinnerSeat,
    nextLeaderLabel,
    summaryText: `${winnerLabel} wins trick${winningCardLabel ? ` with ${winningCardLabel}` : ""}`
  };
}

export function buildTrickAnimationState(trick: CurrentTrickView): TrickAnimationState {
  const winner = getTrickWinnerPresentation(trick);
  const phase = trick.isShowingCompletedTrick
    ? "collecting"
    : trick.plays.length === 4
      ? "winner"
      : trick.plays.length > 0
        ? trick.plays.length === 1
          ? "placing"
          : "settled"
        : "empty";

  return {
    phase,
    cards: trick.plays.map((play, index) => ({
      seat: play.seat,
      cardLabel: cardLabel(play.card),
      slot: getSeatTrickSlot(play.seat),
      isWinningCard: play.isWinningCard,
      playOrder: index,
      animationDelayMs: index * 55
    })),
    collectTarget: winner.winnerSeat === undefined ? undefined : getTrickCollectTarget(winner.winnerSeat),
    winner,
    placementDurationMs: 260,
    winnerPauseMs: 560,
    collectionDurationMs: 420,
    reducedMotionSafe: true
  };
}

export function seatName(seat: PlayerIndex): string {
  return TABLE_PLAYER_NAMES[seat];
}
