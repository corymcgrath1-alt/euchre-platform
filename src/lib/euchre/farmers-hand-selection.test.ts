import { describe, expect, it } from "vitest";
import { cardId } from "./cards";
import {
  canSubmitFarmersHandReplacement,
  selectedFarmersHandReplacementCards,
  toggleFarmersHandReplacementSelection
} from "./farmers-hand-selection";
import type { Card } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("manual farmer's hand replacement selection", () => {
  const hand = [
    c("9", "clubs"),
    c("10", "clubs"),
    c("Q", "hearts"),
    c("9", "spades"),
    c("A", "diamonds")
  ];
  const eligible = [hand[0], hand[1], hand[3]];

  it("selects one to three eligible cards", () => {
    let selected: string[] = [];
    selected = toggleFarmersHandReplacementSelection({ selectedIds: selected, card: hand[0], eligibleCards: eligible });
    selected = toggleFarmersHandReplacementSelection({ selectedIds: selected, card: hand[1], eligibleCards: eligible });
    selected = toggleFarmersHandReplacementSelection({ selectedIds: selected, card: hand[3], eligibleCards: eligible });

    expect(selected).toEqual([cardId(hand[0]), cardId(hand[1]), cardId(hand[3])]);
    expect(selectedFarmersHandReplacementCards(hand, selected)).toEqual([hand[0], hand[1], hand[3]]);
    expect(canSubmitFarmersHandReplacement(selected)).toBe(true);
  });

  it("does not select non-eligible cards", () => {
    const selected = toggleFarmersHandReplacementSelection({
      selectedIds: [],
      card: hand[2],
      eligibleCards: eligible
    });

    expect(selected).toEqual([]);
  });

  it("does not select more than three cards", () => {
    const extraEligible = [...eligible, hand[4]];
    const selected = extraEligible.reduce((current, card) => (
      toggleFarmersHandReplacementSelection({ selectedIds: current, card, eligibleCards: extraEligible })
    ), [] as string[]);

    expect(selected).toHaveLength(3);
  });

  it("does not allow submitting zero selected cards", () => {
    expect(canSubmitFarmersHandReplacement([])).toBe(false);
  });
});
