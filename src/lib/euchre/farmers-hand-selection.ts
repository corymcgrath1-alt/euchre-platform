import { cardId } from "./cards";
import type { Card } from "./types";

export function selectedFarmersHandReplacementCards(hand: Card[], selectedIds: string[]): Card[] {
  return hand.filter((card) => selectedIds.includes(cardId(card)));
}

export function canSubmitFarmersHandReplacement(selectedIds: string[]): boolean {
  return selectedIds.length >= 1 && selectedIds.length <= 3;
}

export function toggleFarmersHandReplacementSelection({
  selectedIds,
  card,
  eligibleCards,
  maxCards = 3
}: {
  selectedIds: string[];
  card: Card;
  eligibleCards: Card[];
  maxCards?: number;
}): string[] {
  const id = cardId(card);
  const eligibleIds = new Set(eligibleCards.map(cardId));
  if (!eligibleIds.has(id)) {
    return selectedIds;
  }

  if (selectedIds.includes(id)) {
    return selectedIds.filter((candidate) => candidate !== id);
  }

  if (selectedIds.length >= maxCards) {
    return selectedIds;
  }

  return [...selectedIds, id];
}
