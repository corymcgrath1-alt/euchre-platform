import { createDeck } from "./cards";
import type { Card, PlayerIndex } from "./types";

export function nextPlayer(player: PlayerIndex): PlayerIndex {
  return (((player + 1) % 4) as PlayerIndex);
}

export function previousPlayer(player: PlayerIndex): PlayerIndex {
  return (((player + 3) % 4) as PlayerIndex);
}

export function partnerOf(player: PlayerIndex): PlayerIndex {
  return (((player + 2) % 4) as PlayerIndex);
}

export function teamOf(player: PlayerIndex): 0 | 1 {
  return (player % 2) as 0 | 1;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeck(seed: number): Card[] {
  const random = seededRandom(seed);
  const deck = createDeck();

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function dealHands(seed: number): {
  hands: Record<PlayerIndex, Card[]>;
  kitty: Card[];
} {
  const deck = shuffleDeck(seed);
  const hands: Record<PlayerIndex, Card[]> = {
    0: [],
    1: [],
    2: [],
    3: []
  };

  for (let index = 0; index < 20; index += 1) {
    const player = (index % 4) as PlayerIndex;
    hands[player] = [...hands[player], deck[index]];
  }

  return {
    hands,
    kitty: deck.slice(20)
  };
}
