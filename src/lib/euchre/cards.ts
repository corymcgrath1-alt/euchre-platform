import { RANKS, SUITS, type Card, type Rank, type Suit } from "./types";

const RED_SUITS: Suit[] = ["diamonds", "hearts"];
const BLACK_SUITS: Suit[] = ["clubs", "spades"];

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function cardId(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

export function cardLabel(card: Card): string {
  return `${card.rank}${suitSymbol(card.suit)}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function suitSymbol(suit: Suit): string {
  return {
    clubs: "C",
    diamonds: "D",
    hearts: "H",
    spades: "S"
  }[suit];
}

export function suitColor(suit: Suit): "red" | "black" {
  return RED_SUITS.includes(suit) ? "red" : "black";
}

export function sameColorSuit(suit: Suit): Suit {
  const group = suitColor(suit) === "red" ? RED_SUITS : BLACK_SUITS;
  return group.find((candidate) => candidate !== suit) ?? suit;
}

export function isRightBower(card: Card, trump: Suit): boolean {
  return card.rank === "J" && card.suit === trump;
}

export function isLeftBower(card: Card, trump: Suit): boolean {
  return card.rank === "J" && card.suit === sameColorSuit(trump);
}

export function effectiveSuit(card: Card, trump?: Suit): Suit {
  if (trump && isLeftBower(card, trump)) {
    return trump;
  }

  return card.suit;
}

export function isTrump(card: Card, trump: Suit): boolean {
  return effectiveSuit(card, trump) === trump;
}

export function compareCardsForSort(a: Card, b: Card): number {
  const suitComparison = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  if (suitComparison !== 0) {
    return suitComparison;
  }

  return RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
}

export function removeCard(cards: Card[], card: Card): Card[] {
  const index = cards.findIndex((candidate) => sameCard(candidate, card));
  if (index === -1) {
    throw new Error(`Card ${cardId(card)} is not in hand`);
  }

  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}

export function rankPower(rank: Rank): number {
  return {
    "9": 1,
    "10": 2,
    J: 3,
    Q: 4,
    K: 5,
    A: 6
  }[rank];
}
