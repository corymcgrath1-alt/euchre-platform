import { chooseBotAction, type BotProfile } from "./bots";
import {
  cardId,
  compareCardsForSort,
  effectiveSuit,
  isLeftBower,
  isRightBower,
  isTrump,
  rankPower,
  sameColorSuit
} from "./cards";
import { partnerOf, teamOf } from "./deck";
import {
  cardTrickPower,
  getLedSuit,
  legalActionsForPlayer
} from "./rules";
import type { Card, GameAction, GameState, PlayerIndex, Suit, Trick } from "./types";

export type IntermediateHandStrength = {
  total: number;
  trumpCards: number;
  bowers: number;
  rightBower: boolean;
  leftBower: boolean;
  offAces: number;
  voidCount: number;
  strongestCards: string[];
  lonerCandidate: boolean;
};

type CandidateTrumpStrength = IntermediateHandStrength & {
  suit: Suit;
};

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

export function chooseIntermediateBotAction(state: GameState, bot: BotProfile): GameAction | null {
  if (!bot.enabled || state.activePlayer !== bot.seat) {
    return null;
  }

  const farmersHandAction = chooseIntermediateFarmersHandAction(state, bot.seat);
  if (farmersHandAction) {
    return farmersHandAction;
  }

  switch (state.phase) {
    case "ordering":
      return chooseIntermediateOrderUp(state, bot.seat);
    case "calling":
      return chooseIntermediateCallTrump(state, bot.seat);
    case "discarding":
      return chooseIntermediateDiscardAction(state, bot.seat);
    case "playing":
      return chooseIntermediatePlayAction(state, bot.seat);
    default:
      return chooseBotAction(state, bot, state.config.botDifficulty);
  }
}

export function evaluateIntermediateHandStrength(
  hand: Card[],
  trump: Suit,
  upcard?: Card,
  includeUpcard = false
): IntermediateHandStrength {
  const evaluatedHand = includeUpcard && upcard ? [...hand, upcard] : hand;
  const suitCounts = new Map<Suit, number>();
  let total = 0;
  let trumpCards = 0;
  let bowers = 0;
  let offAces = 0;
  let highTrump = 0;
  let rightBower = false;
  let leftBower = false;

  for (const card of evaluatedHand) {
    const suit = effectiveSuit(card, trump);
    suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1);

    if (isRightBower(card, trump)) {
      total += 5.2;
      trumpCards += 1;
      bowers += 1;
      highTrump += 1;
      rightBower = true;
      continue;
    }

    if (isLeftBower(card, trump)) {
      total += 4.4;
      trumpCards += 1;
      bowers += 1;
      highTrump += 1;
      leftBower = true;
      continue;
    }

    if (isTrump(card, trump)) {
      trumpCards += 1;
      total += trumpRankValue(card);
      if (card.rank === "A" || card.rank === "K" || card.rank === "Q") {
        highTrump += 1;
      }
      continue;
    }

    total += offSuitValue(card);
    if (card.rank === "A") {
      offAces += 1;
    }
  }

  const voidCount = SUITS.filter((suit) => suit !== trump && !suitCounts.get(suit)).length;
  total += trumpCards >= 2 ? voidCount * 0.3 : -Math.max(0, 2 - trumpCards) * 0.25;
  total += bowers >= 2 ? 0.8 : 0;
  total += trumpCards >= 3 ? 0.6 : 0;
  total += highTrump >= 3 ? 0.45 : 0;
  total += offAces >= 2 ? 0.35 : 0;

  if (trumpCards <= 1 && offAces === 0) {
    total -= 0.6;
  }

  const roundedTotal = round(total);
  const lonerCandidate =
    roundedTotal >= 12.2 &&
    rightBower &&
    (leftBower || highTrump >= 3) &&
    trumpCards >= 3 &&
    (offAces >= 1 || trumpCards >= 4);

  return {
    total: roundedTotal,
    trumpCards,
    bowers,
    rightBower,
    leftBower,
    offAces,
    voidCount,
    strongestCards: [...evaluatedHand]
      .sort((a, b) => intermediateCardValue(b, trump) - intermediateCardValue(a, trump) || compareCardsForSort(a, b) || cardId(a).localeCompare(cardId(b)))
      .slice(0, 3)
      .map(cardId),
    lonerCandidate
  };
}

export function shouldIntermediateGoAlone(hand: Card[], trump: Suit, upcard?: Card, includeUpcard = false): boolean {
  const strength = evaluateIntermediateHandStrength(hand, trump, upcard, includeUpcard);
  return strength.lonerCandidate;
}

export function chooseIntermediateDealerDiscard(hand: Card[], trump: Suit): Card {
  return [...hand].sort((a, b) => discardValue(a, trump) - discardValue(b, trump) || compareCardsForSort(a, b) || cardId(a).localeCompare(cardId(b)))[0];
}

function chooseIntermediateFarmersHandAction(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.canClaimFarmersHand) {
    return null;
  }

  if (state.config.farmersHandMode === "redeal") {
    return {
      type: "FARMERS_HAND_REDEAL",
      player,
      seed: 900_000 + state.handNumber * 1_000 + state.moveLog.length * 10 + player
    };
  }

  if (state.config.farmersHandMode === "replaceThree") {
    const cards = [...legal.farmersHandReplaceableCards]
      .sort((a, b) => intermediateCardValue(a, "clubs") - intermediateCardValue(b, "clubs") || cardId(a).localeCompare(cardId(b)))
      .slice(0, Math.min(3, Math.max(0, state.kitty.length - 1)));
    if (cards.length) {
      return { type: "FARMERS_HAND_REPLACE", player, cards };
    }
  }

  return legal.canDeclineFarmersHand ? { type: "FARMERS_HAND_DECLINE", player } : null;
}

function chooseIntermediateOrderUp(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.canOrderUp || !state.upcard) {
    return legal.canPass ? { type: "PASS", player } : null;
  }

  const trump = state.upcard.suit;
  const includeUpcard = player === state.dealer;
  const strength = contextualStrength(state, player, trump, 1, includeUpcard);
  const threshold = roundOneThreshold(state, player);

  if (strength.total >= threshold) {
    return {
      type: "ORDER_UP",
      player,
      alone: shouldIntermediateGoAlone(state.hands[player], trump, state.upcard, includeUpcard)
    };
  }

  return legal.canPass ? { type: "PASS", player } : null;
}

function chooseIntermediateCallTrump(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.callableSuits.length) {
    return legal.canPass ? { type: "PASS", player } : null;
  }

  const ranked = legal.callableSuits
    .map((suit) => contextualStrength(state, player, suit, 2, false))
    .sort((a, b) => b.total - a.total || b.trumpCards - a.trumpCards || suitOrder(a.suit) - suitOrder(b.suit));
  const best = ranked[0];
  const forced = !legal.canPass;

  if (forced || best.total >= roundTwoThreshold(state, player, best.suit)) {
    return {
      type: "CALL_TRUMP",
      player,
      suit: best.suit,
      alone: !forced && shouldIntermediateGoAlone(state.hands[player], best.suit)
    };
  }

  return { type: "PASS", player };
}

function chooseIntermediateDiscardAction(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.mustDiscard || player !== state.dealer || !state.trump) {
    return null;
  }

  return {
    type: "DISCARD",
    player,
    card: chooseIntermediateDealerDiscard(state.hands[player], state.trump)
  };
}

function chooseIntermediatePlayAction(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!state.trump || !legal.playableCards.length) {
    return null;
  }

  const card = state.currentTrick?.plays.length
    ? chooseIntermediateFollowCard(state, player, legal.playableCards)
    : chooseIntermediateLeadCard(state, player, legal.playableCards);
  return card ? { type: "PLAY_CARD", player, card } : null;
}

function chooseIntermediateLeadCard(state: GameState, player: PlayerIndex, legalCards: Card[]): Card | null {
  if (!state.trump) {
    return null;
  }

  const trump = state.trump;
  const strength = evaluateIntermediateHandStrength(state.hands[player], trump);
  const trumpCards = legalCards.filter((card) => isTrump(card, trump));
  const offAce = legalCards
    .filter((card) => card.rank === "A" && !isTrump(card, trump))
    .sort((a, b) => intermediateCardValue(b, trump) - intermediateCardValue(a, trump) || cardId(a).localeCompare(cardId(b)))[0];

  if ((strength.bowers >= 1 && strength.trumpCards >= 3) || (strength.rightBower && strength.leftBower)) {
    return strongestCard(trumpCards, trump) ?? offAce ?? weakestCard(legalCards, trump);
  }

  return offAce ?? weakestCard(legalCards, trump);
}

function chooseIntermediateFollowCard(state: GameState, player: PlayerIndex, legalCards: Card[]): Card | null {
  if (!state.trump || !state.currentTrick) {
    return null;
  }

  const winner = currentWinningPlay(state.currentTrick, state.trump);
  if (winner && teamOf(winner.player) === teamOf(player)) {
    return weakestCard(legalCards, state.trump);
  }

  const winningCard = lowestWinningCard(legalCards, state.currentTrick, state.trump);
  return winningCard ?? weakestCard(legalCards, state.trump);
}

function contextualStrength(
  state: GameState,
  player: PlayerIndex,
  trump: Suit,
  roundNumber: 1 | 2,
  includeUpcard: boolean
): CandidateTrumpStrength {
  const strength = evaluateIntermediateHandStrength(state.hands[player], trump, state.upcard, includeUpcard);
  let total = strength.total;
  const scoreGap = state.scores[teamOf(player)] - state.scores[teamOf(player) === 0 ? 1 : 0];

  if (player === state.dealer) {
    total += roundNumber === 1 ? 0.6 : 0.35;
  }
  if (partnerOf(player) === state.dealer) {
    total += roundNumber === 1 ? 0.65 : 0.2;
  }
  if (teamOf(player) !== teamOf(state.dealer)) {
    total -= roundNumber === 1 ? 0.45 : 0.1;
  }
  if (roundNumber === 2 && state.turnedDownSuit && trump === sameColorSuit(state.turnedDownSuit)) {
    total += 0.4;
  }
  if (scoreGap <= -4) {
    total += 0.25;
  }
  if (scoreGap >= 4) {
    total -= 0.2;
  }

  return {
    ...strength,
    suit: trump,
    total: round(total)
  };
}

function roundOneThreshold(state: GameState, player: PlayerIndex): number {
  const passes = state.bids.filter((bid) => bid.round === 1 && bid.decision === "pass").length;
  if (player === state.dealer) {
    return passes >= 3 ? 8.0 : 8.4;
  }
  if (partnerOf(player) === state.dealer) {
    return 8.5;
  }
  return passes === 0 ? 9.7 : 9.4;
}

function roundTwoThreshold(state: GameState, player: PlayerIndex, trump: Suit): number {
  const nextSuit = state.turnedDownSuit ? sameColorSuit(state.turnedDownSuit) : undefined;
  let threshold = trump === nextSuit ? 6.6 : 7.25;
  if (player === state.dealer) {
    threshold -= 0.35;
  }
  if (teamOf(player) !== teamOf(state.dealer)) {
    threshold += 0.2;
  }
  return threshold;
}

function lowestWinningCard(cards: Card[], trick: Trick, trump: Suit): Card | null {
  const ledSuit = getLedSuit(trick, trump);
  const currentWinner = currentWinningPlay(trick, trump);
  if (!ledSuit || !currentWinner) {
    return null;
  }

  return cards
    .filter((card) => cardTrickPower(card, trump, ledSuit) > cardTrickPower(currentWinner.card, trump, ledSuit))
    .sort((a, b) => trickCardValue(a, trump, ledSuit) - trickCardValue(b, trump, ledSuit) || cardId(a).localeCompare(cardId(b)))[0] ?? null;
}

function currentWinningPlay(trick: Trick, trump: Suit) {
  const ledSuit = getLedSuit(trick, trump);
  if (!ledSuit || !trick.plays.length) {
    return undefined;
  }

  return trick.plays.reduce((best, play) => {
    const bestPower = cardTrickPower(best.card, trump, ledSuit);
    const candidatePower = cardTrickPower(play.card, trump, ledSuit);
    return candidatePower > bestPower ? play : best;
  });
}

function strongestCard(cards: Card[], trump: Suit): Card | null {
  return [...cards].sort((a, b) => intermediateCardValue(b, trump) - intermediateCardValue(a, trump) || cardId(a).localeCompare(cardId(b)))[0] ?? null;
}

function weakestCard(cards: Card[], trump: Suit): Card | null {
  return [...cards].sort((a, b) => intermediateCardValue(a, trump) - intermediateCardValue(b, trump) || cardId(a).localeCompare(cardId(b)))[0] ?? null;
}

function discardValue(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) return 220;
  if (isLeftBower(card, trump)) return 205;
  if (isTrump(card, trump)) return 125 + rankPower(card.rank);
  if (card.rank === "A") return 95;
  if (card.rank === "K") return 18;
  if (card.rank === "Q") return 12;
  if (card.rank === "J") return 10;
  return rankPower(card.rank);
}

function intermediateCardValue(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) return 220;
  if (isLeftBower(card, trump)) return 205;
  if (isTrump(card, trump)) return 130 + rankPower(card.rank);
  if (card.rank === "A") return 85;
  if (card.rank === "K") return 35;
  if (card.rank === "Q") return 24;
  if (card.rank === "J") return 18;
  return rankPower(card.rank);
}

function trickCardValue(card: Card, trump: Suit, ledSuit: Suit): number {
  if (isTrump(card, trump)) {
    return 100 + intermediateCardValue(card, trump);
  }
  if (effectiveSuit(card, trump) === ledSuit) {
    return 40 + rankPower(card.rank);
  }
  return intermediateCardValue(card, trump);
}

function trumpRankValue(card: Card): number {
  switch (card.rank) {
    case "A":
      return 3.4;
    case "K":
      return 2.65;
    case "Q":
      return 2.05;
    case "10":
      return 1.45;
    case "9":
      return 1.15;
    case "J":
      return 2.4;
    default:
      card.rank satisfies never;
      return 0;
  }
}

function offSuitValue(card: Card): number {
  switch (card.rank) {
    case "A":
      return 1.25;
    case "K":
      return 0.45;
    case "Q":
      return 0.25;
    case "J":
      return 0.2;
    case "10":
      return 0.05;
    case "9":
      return 0;
    default:
      card.rank satisfies never;
      return 0;
  }
}

function suitOrder(suit: Suit): number {
  return {
    clubs: 0,
    diamonds: 1,
    hearts: 2,
    spades: 3
  }[suit];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
