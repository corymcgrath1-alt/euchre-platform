import type { Card, Suit } from "@/lib/euchre";

export type PracticeCommandResult = boolean | Promise<boolean>;

export interface PracticeCommandHandlers {
  readonly onPass: () => PracticeCommandResult;
  readonly onOrderUp: (alone: boolean) => PracticeCommandResult;
  readonly onCallTrump: (suit: Suit, alone: boolean) => PracticeCommandResult;
  readonly onDeclineFarmersHand: () => PracticeCommandResult;
  readonly onClaimFarmersHandRedeal: () => PracticeCommandResult;
  readonly onReplaceFarmersHandCards: (cards: readonly Card[]) => PracticeCommandResult;
  readonly onDiscard: (card: Card) => PracticeCommandResult;
  readonly onPlayCard: (card: Card) => PracticeCommandResult;
}
