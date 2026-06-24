import type { CardPlayReview, GameReview, HandReview, TrickReview } from "./game-review";

export interface ReplaySelection {
  handIndex: number;
  trickIndex: number;
}

export interface SelectedReplayState {
  selection: ReplaySelection;
  hand: HandReview | null;
  trick: TrickReview | null;
  winningPlay: CardPlayReview | null;
}

export function createInitialReplaySelection(review: GameReview): ReplaySelection {
  return {
    handIndex: clampIndex(0, review.hands.length),
    trickIndex: 0
  };
}

export function selectReplayHand(review: GameReview, handIndex: number): ReplaySelection {
  return {
    handIndex: clampIndex(handIndex, review.hands.length),
    trickIndex: 0
  };
}

export function selectReplayTrick(review: GameReview, selection: ReplaySelection, trickIndex: number): ReplaySelection {
  const handIndex = clampIndex(selection.handIndex, review.hands.length);
  const hand = review.hands[handIndex];

  return {
    handIndex,
    trickIndex: clampIndex(trickIndex, hand?.tricks.length ?? 0)
  };
}

export function previousReplayHand(review: GameReview, selection: ReplaySelection): ReplaySelection {
  return selectReplayHand(review, selection.handIndex - 1);
}

export function nextReplayHand(review: GameReview, selection: ReplaySelection): ReplaySelection {
  return selectReplayHand(review, selection.handIndex + 1);
}

export function previousReplayTrick(review: GameReview, selection: ReplaySelection): ReplaySelection {
  return selectReplayTrick(review, selection, selection.trickIndex - 1);
}

export function nextReplayTrick(review: GameReview, selection: ReplaySelection): ReplaySelection {
  return selectReplayTrick(review, selection, selection.trickIndex + 1);
}

export function resetReplaySelection(review: GameReview): ReplaySelection {
  return createInitialReplaySelection(review);
}

export function getSelectedReplay(review: GameReview, selection: ReplaySelection): SelectedReplayState {
  const handIndex = clampIndex(selection.handIndex, review.hands.length);
  const hand = review.hands[handIndex] ?? null;
  const trickIndex = clampIndex(selection.trickIndex, hand?.tricks.length ?? 0);
  const trick = hand?.tricks[trickIndex] ?? null;
  const winningPlay = trick?.cardsPlayed.find((play) => play.player === trick.winningSeat) ?? null;

  return {
    selection: {
      handIndex,
      trickIndex
    },
    hand,
    trick,
    winningPlay
  };
}

export function formatReplayHandLabel(hand: HandReview | null): string {
  return hand ? `Hand ${hand.handNumber}` : "No hand";
}

export function formatReplayTrickLabel(trick: TrickReview | null): string {
  return trick ? `Trick ${trick.trickNumber}` : "No trick";
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}
