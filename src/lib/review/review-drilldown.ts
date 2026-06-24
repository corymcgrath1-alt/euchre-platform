import type { GameReviewSummary } from "./game-review";
import { createInitialReplaySelection, type ReplaySelection } from "./replay-viewer";

export interface HistoricalReviewState {
  gameId: string;
  review: GameReviewSummary;
}

export interface ActiveReviewSource {
  kind: "current" | "historical";
  gameId: string;
  label: string;
  review: GameReviewSummary;
}

export function profileHistoryGameId(gameId: string): string {
  return gameId;
}

export function chooseActiveReviewSource({
  currentReview,
  historicalReview
}: {
  currentReview: GameReviewSummary | null;
  historicalReview: HistoricalReviewState | null;
}): ActiveReviewSource | null {
  if (historicalReview) {
    return {
      kind: "historical",
      gameId: historicalReview.gameId,
      label: formatReviewedGameLabel("historical", historicalReview.gameId),
      review: historicalReview.review
    };
  }

  if (currentReview) {
    return {
      kind: "current",
      gameId: currentReview.gameId,
      label: formatReviewedGameLabel("current", currentReview.gameId),
      review: currentReview
    };
  }

  return null;
}

export function initializeReplaySelectionForReview(review: GameReviewSummary): ReplaySelection {
  return createInitialReplaySelection(review);
}

export function clearHistoricalReviewState(): HistoricalReviewState | null {
  return null;
}

export function formatReviewedGameLabel(kind: "current" | "historical", gameId: string): string {
  const prefix = kind === "current" ? "Current game review" : "Historical review";
  return `${prefix}: ${gameId}`;
}
