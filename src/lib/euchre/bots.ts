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
import type { BotDifficulty, Card, GameAction, GameState, PlayerIndex, Suit, Trick } from "./types";

export interface BotProfile {
  id: string;
  name: string;
  seat: PlayerIndex;
  enabled: boolean;
}

export interface TrumpStrength {
  suit: Suit;
  score: number;
  trumpCount: number;
  highTrumpCount: number;
  offSuitAces: number;
  hasRight: boolean;
  hasLeft: boolean;
  hasTrumpAce: boolean;
  voidCount: number;
  singletonCount: number;
}

export function createDefaultBotProfiles(): BotProfile[] {
  return [
    { id: "bot-seat-1", name: "West Bot", seat: 1, enabled: true },
    { id: "bot-seat-2", name: "North Bot", seat: 2, enabled: true },
    { id: "bot-seat-3", name: "East Bot", seat: 3, enabled: true }
  ];
}

export function chooseBotAction(
  state: GameState,
  bot: BotProfile,
  difficulty: BotDifficulty = botDifficultyForState(state)
): GameAction | null {
  if (!bot.enabled || state.activePlayer !== bot.seat) {
    return null;
  }

  if (state.phase === "farmersHand") {
    return chooseFarmersHandAction(state, bot.seat);
  }

  if (state.phase === "ordering") {
    return chooseRoundOneBid(state, bot.seat, difficulty);
  }

  if (state.phase === "calling") {
    return chooseRoundTwoCall(state, bot.seat, difficulty);
  }

  if (state.phase === "discarding") {
    const legal = legalActionsForPlayer(state, bot.seat);
    if (!legal.mustDiscard || bot.seat !== state.dealer || !state.trump) {
      return null;
    }

    return {
      type: "DISCARD",
      player: bot.seat,
      card: chooseDealerDiscard(state.hands[bot.seat], state.trump, difficulty)
    };
  }

  if (state.phase === "playing") {
    const legal = legalActionsForPlayer(state, bot.seat);
    const card = state.currentTrick?.plays.length
      ? chooseFollowCard(state, bot.seat, legal.playableCards, difficulty)
      : chooseLeadCard(state, bot.seat, legal.playableCards, difficulty);

    return card ? { type: "PLAY_CARD", player: bot.seat, card } : null;
  }

  return null;
}

export function chooseFarmersHandAction(state: GameState, player: PlayerIndex): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.canDeclineFarmersHand) {
    return null;
  }

  if (legal.canClaimFarmersHand && state.config.farmersHandMode === "redeal") {
    return {
      type: "FARMERS_HAND_REDEAL",
      player,
      seed: deterministicFarmersHandRedealSeed(state, player)
    };
  }

  if (legal.canClaimFarmersHand && state.config.farmersHandMode === "replaceThree") {
    const cards = [...legal.farmersHandReplaceableCards]
      .sort((a, b) => compareCardValueForBot(a, b, "clubs"))
      .slice(0, Math.min(3, Math.max(0, state.kitty.length - 1)));
    if (cards.length) {
      return { type: "FARMERS_HAND_REPLACE", player, cards };
    }
  }

  return { type: "FARMERS_HAND_DECLINE", player };
}

export function botDifficultyForState(state: GameState): BotDifficulty {
  return state.config.botDifficulty ?? "standard";
}

export function evaluateTrumpStrength(hand: Card[], trump: Suit): TrumpStrength {
  const trumpCards = hand.filter((card) => isTrump(card, trump));
  const highTrumpCards = trumpCards.filter((card) => trumpCardPower(card, trump) >= trumpCardPower({ rank: "K", suit: trump }, trump));
  const offSuitAces = hand.filter((card) => card.rank === "A" && !isTrump(card, trump)).length;
  const suitCounts = new Map<Suit, number>();

  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1);
  }

  const nonTrumpSuits = (["clubs", "diamonds", "hearts", "spades"] as Suit[]).filter((suit) => suit !== trump);
  const voidCount = nonTrumpSuits.filter((suit) => !suitCounts.get(suit)).length;
  const singletonCount = nonTrumpSuits.filter((suit) => suitCounts.get(suit) === 1).length;
  const hasRight = hand.some((card) => isRightBower(card, trump));
  const hasLeft = hand.some((card) => isLeftBower(card, trump));
  const hasTrumpAce = hand.some((card) => card.rank === "A" && card.suit === trump);

  let score = 0;
  if (hasRight) {
    score += 3.2;
  }
  if (hasLeft) {
    score += 2.4;
  }
  if (hasTrumpAce) {
    score += 1.8;
  }

  score += trumpCards.length * 0.9;
  score += highTrumpCards.length * 0.7;
  score += offSuitAces * 0.8;
  score += voidCount * 0.25;
  score += singletonCount * 0.15;

  return {
    suit: trump,
    score,
    trumpCount: trumpCards.length,
    highTrumpCount: highTrumpCards.length,
    offSuitAces,
    hasRight,
    hasLeft,
    hasTrumpAce,
    voidCount,
    singletonCount
  };
}

export function evaluateCallStrength({
  hand,
  trump,
  player,
  dealer,
  upcard,
  round,
  turnedDownSuit
}: {
  hand: Card[];
  trump: Suit;
  player: PlayerIndex;
  dealer: PlayerIndex;
  upcard?: Card;
  round: 1 | 2;
  turnedDownSuit?: Suit;
}): TrumpStrength {
  const evaluatedHand = player === dealer && upcard && upcard.suit === trump
    ? [...hand, upcard]
    : hand;
  const strength = evaluateTrumpStrength(evaluatedHand, trump);
  let contextScore = strength.score;

  if (player === dealer) {
    contextScore += round === 1 ? 1.0 : 0.45;
  }

  if (partnerOf(player) === dealer) {
    contextScore += round === 1 ? 1.2 : 0.35;
  }

  if (teamOf(player) !== teamOf(dealer)) {
    contextScore -= round === 1 ? 0.8 : 0.2;
  }

  if (round === 2 && turnedDownSuit && trump === sameColorSuit(turnedDownSuit)) {
    contextScore += 0.65;
  }

  if (round === 2 && turnedDownSuit && trump !== sameColorSuit(turnedDownSuit)) {
    contextScore -= 0.35;
  }

  return {
    ...strength,
    score: contextScore
  };
}

export function chooseRoundOneBid(state: GameState, player: PlayerIndex, difficulty: BotDifficulty = "standard"): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.canOrderUp || !state.upcard) {
    return legal.canPass ? { type: "PASS", player } : null;
  }

  const trump = state.upcard.suit;
  const strength = evaluateCallStrength({
    hand: state.hands[player],
    trump,
    player,
    dealer: state.dealer,
    upcard: state.upcard,
    round: 1
  });
  const threshold = roundOneThreshold(player, state.dealer, difficulty);

  if (strength.score >= threshold) {
    return {
      type: "ORDER_UP",
      player,
      alone: shouldGoAlone(state.hands[player], trump, state.upcard, player === state.dealer, difficulty)
    };
  }

  return legal.canPass ? { type: "PASS", player } : null;
}

export function chooseRoundTwoCall(state: GameState, player: PlayerIndex, difficulty: BotDifficulty = "standard"): GameAction | null {
  const legal = legalActionsForPlayer(state, player);
  if (!legal.callableSuits.length) {
    return legal.canPass ? { type: "PASS", player } : null;
  }

  const ranked = legal.callableSuits
    .map((suit) => evaluateCallStrength({
      hand: state.hands[player],
      trump: suit,
      player,
      dealer: state.dealer,
      round: 2,
      turnedDownSuit: state.turnedDownSuit
    }))
    .sort(compareStrengthForCall);
  const best = ranked[0];
  const forced = !legal.canPass;
  const nextSuit = state.turnedDownSuit ? sameColorSuit(state.turnedDownSuit) : undefined;
  const threshold = roundTwoThreshold(best.suit === nextSuit, difficulty);

  if (forced || best.score >= threshold) {
    return {
      type: "CALL_TRUMP",
      player,
      suit: best.suit,
      alone: shouldGoAlone(state.hands[player], best.suit, undefined, false, difficulty)
    };
  }

  return { type: "PASS", player };
}

export function shouldGoAlone(
  hand: Card[],
  trump: Suit,
  upcard?: Card,
  includeUpcard = false,
  difficulty: BotDifficulty = "standard"
): boolean {
  const evaluatedHand = includeUpcard && upcard && upcard.suit === trump ? [...hand, upcard] : hand;
  const strength = evaluateTrumpStrength(evaluatedHand, trump);
  const hasAceOrKingTrump = evaluatedHand.some((card) => isTrump(card, trump) && (card.rank === "A" || card.rank === "K"));

  if (difficulty === "easy") {
    return strength.hasRight && strength.hasLeft && strength.hasTrumpAce && strength.trumpCount >= 4 && strength.offSuitAces >= 1;
  }

  if (strength.hasRight && strength.hasLeft && hasAceOrKingTrump) {
    return true;
  }

  if (difficulty === "strong" && strength.hasRight && strength.trumpCount >= 3 && strength.highTrumpCount >= 2 && strength.offSuitAces >= 1) {
    return true;
  }

  if (strength.trumpCount >= 3 && strength.highTrumpCount >= 2 && strength.offSuitAces >= 1 && strength.score >= 8.6) {
    return true;
  }

  const fallbackThreshold = difficulty === "strong" ? 9.8 : 10.2;
  return strength.trumpCount >= 4 && strength.highTrumpCount >= 3 && strength.score >= fallbackThreshold;
}

export function chooseDealerDiscard(hand: Card[], trump: Suit, difficulty: BotDifficulty = "standard"): Card {
  if (difficulty === "easy") {
    return chooseEasyDiscard(hand, trump);
  }

  return [...hand].sort((a, b) => compareDiscardValue(a, b, trump))[0];
}

export function chooseWeakestDiscard(cards: Card[], trump: Suit): Card | null {
  return [...cards].sort((a, b) => compareDiscardValue(a, b, trump))[0] ?? null;
}

export function chooseLeadCard(
  state: GameState,
  player: PlayerIndex,
  legalCards = legalActionsForPlayer(state, player).playableCards,
  difficulty: BotDifficulty = "standard"
): Card | null {
  if (!state.trump || !legalCards.length) {
    return null;
  }

  const trump = state.trump;
  const trumpCards = legalCards.filter((card) => isTrump(card, trump));
  const strength = evaluateTrumpStrength(state.hands[player], trump);

  if (difficulty === "easy") {
    return chooseWeakestDiscard(legalCards, trump);
  }

  if (strongTrumpLead(strength, difficulty) && trumpCards.length) {
    return strongestCard(trumpCards, trump);
  }

  const offSuitAce = [...legalCards]
    .filter((card) => card.rank === "A" && !isTrump(card, trump))
    .sort((a, b) => compareCardValueForBot(b, a, trump))[0];

  if (offSuitAce) {
    return offSuitAce;
  }

  if (strength.hasRight && strength.hasLeft && trumpCards.length) {
    return strongestCard(trumpCards, trump);
  }

  return chooseWeakestDiscard(legalCards, trump);
}

export function chooseFollowCard(
  state: GameState,
  player: PlayerIndex,
  legalCards = legalActionsForPlayer(state, player).playableCards,
  difficulty: BotDifficulty = "standard"
): Card | null {
  if (!state.trump || !state.currentTrick || !legalCards.length) {
    return null;
  }

  if (difficulty === "easy") {
    return chooseEasyFollowCard(state, player, legalCards);
  }

  const currentWinner = currentTrickWinner(state.currentTrick, state.trump);
  if (currentWinner !== undefined && teamOf(currentWinner) === teamOf(player)) {
    return chooseWeakestDiscard(legalCards, state.trump);
  }

  const winningCard = chooseLowestWinningCard(legalCards, state.currentTrick, state.trump);
  if (winningCard) {
    return winningCard;
  }

  return chooseWeakestDiscard(legalCards, state.trump);
}

export function chooseLowestWinningCard(cards: Card[], trick: Trick, trump: Suit): Card | null {
  const ledSuit = getLedSuit(trick, trump);
  const currentWinner = currentWinningPlay(trick, trump);

  if (!ledSuit || !currentWinner) {
    return null;
  }

  return cards
    .filter((card) => cardTrickPower(card, trump, ledSuit) > cardTrickPower(currentWinner.card, trump, ledSuit))
    .sort((a, b) => compareCardValueForBot(a, b, trump, ledSuit))[0] ?? null;
}

export function compareCardValueForBot(a: Card, b: Card, trump: Suit, ledSuit?: Suit): number {
  const suit = ledSuit ?? effectiveSuit(a, trump);
  const powerComparison = botCardPower(a, trump, suit) - botCardPower(b, trump, suit);
  return powerComparison || compareCardsForSort(a, b) || cardId(a).localeCompare(cardId(b));
}

function roundOneThreshold(player: PlayerIndex, dealer: PlayerIndex, difficulty: BotDifficulty): number {
  if (difficulty === "easy") {
    if (player === dealer) {
      return 6.25;
    }

    if (partnerOf(player) === dealer) {
      return 7.0;
    }

    return 7.35;
  }

  if (difficulty === "strong") {
    if (player === dealer) {
      return 5.25;
    }

    if (partnerOf(player) === dealer) {
      return 4.95;
    }

    return 6.1;
  }

  if (player === dealer) {
    return 5.4;
  }

  if (partnerOf(player) === dealer) {
    return 5.15;
  }

  return 6.35;
}

function roundTwoThreshold(isNextSuit: boolean, difficulty: BotDifficulty): number {
  if (difficulty === "easy") {
    return isNextSuit ? 6.4 : 7.15;
  }

  if (difficulty === "strong") {
    return isNextSuit ? 4.75 : 6.1;
  }

  return isNextSuit ? 5.15 : 5.85;
}

function compareStrengthForCall(a: TrumpStrength, b: TrumpStrength): number {
  return (
    b.score - a.score ||
    b.trumpCount - a.trumpCount ||
    b.highTrumpCount - a.highTrumpCount ||
    suitOrder(a.suit) - suitOrder(b.suit)
  );
}

function strongestCard(cards: Card[], trump: Suit): Card {
  return [...cards].sort((a, b) => compareCardValueForBot(b, a, trump))[0];
}

function compareDiscardValue(a: Card, b: Card, trump: Suit): number {
  const comparison = discardValue(a, trump) - discardValue(b, trump);
  return comparison || compareCardsForSort(a, b) || cardId(a).localeCompare(cardId(b));
}

function chooseEasyDiscard(hand: Card[], trump: Suit): Card {
  return [...hand].sort((a, b) => easyDiscardValue(a, trump) - easyDiscardValue(b, trump) || compareCardsForSort(a, b))[0];
}

function easyDiscardValue(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) {
    return 160;
  }

  if (isLeftBower(card, trump)) {
    return 145;
  }

  if (isTrump(card, trump)) {
    return 80 + rankPower(card.rank);
  }

  if (card.rank === "A") {
    return 0.5;
  }

  return rankPower(card.rank);
}

function discardValue(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) {
    return 200;
  }

  if (isLeftBower(card, trump)) {
    return 190;
  }

  if (isTrump(card, trump)) {
    return 120 + rankPower(card.rank);
  }

  if (card.rank === "A") {
    return 90;
  }

  return rankPower(card.rank);
}

function botCardPower(card: Card, trump: Suit, ledSuit: Suit): number {
  if (isTrump(card, trump)) {
    return trumpCardPower(card, trump);
  }

  if (effectiveSuit(card, trump) === ledSuit) {
    return 40 + rankPower(card.rank);
  }

  if (card.rank === "A") {
    return 30;
  }

  return rankPower(card.rank);
}

function trumpCardPower(card: Card, trump: Suit): number {
  if (isRightBower(card, trump)) {
    return 100;
  }

  if (isLeftBower(card, trump)) {
    return 95;
  }

  return 70 + rankPower(card.rank);
}

function chooseEasyFollowCard(state: GameState, player: PlayerIndex, legalCards: Card[]): Card | null {
  if (!state.trump || !state.currentTrick) {
    return null;
  }

  const trump = state.trump;
  const currentWinner = currentWinningPlay(state.currentTrick, trump);
  const ledSuit = getLedSuit(state.currentTrick, trump);

  if (!currentWinner || !ledSuit) {
    return chooseWeakestDiscard(legalCards, trump);
  }

  const winningCards = legalCards
    .filter((card) => cardTrickPower(card, trump, ledSuit) > cardTrickPower(currentWinner.card, trump, ledSuit))
    .sort((a, b) => compareCardValueForBot(b, a, trump, ledSuit));

  if (winningCards.length && teamOf(currentWinner.player) !== teamOf(player)) {
    return winningCards[0];
  }

  return chooseWeakestDiscard(legalCards, trump);
}

function strongTrumpLead(strength: TrumpStrength, difficulty: BotDifficulty): boolean {
  if (difficulty === "strong") {
    return strength.trumpCount >= 2 && strength.highTrumpCount >= 2;
  }

  return strength.trumpCount >= 3 && strength.highTrumpCount >= 2;
}

function currentTrickWinner(trick: Trick, trump: Suit): PlayerIndex | undefined {
  return currentWinningPlay(trick, trump)?.player;
}

function currentWinningPlay(trick: Trick, trump: Suit) {
  const ledSuit = getLedSuit(trick, trump);
  if (!ledSuit) {
    return undefined;
  }

  return trick.plays.reduce((best, play) => {
    const bestPower = cardTrickPower(best.card, trump, ledSuit);
    const candidatePower = cardTrickPower(play.card, trump, ledSuit);
    return candidatePower > bestPower ? play : best;
  });
}

function suitOrder(suit: Suit): number {
  return {
    clubs: 0,
    diamonds: 1,
    hearts: 2,
    spades: 3
  }[suit];
}

function deterministicFarmersHandRedealSeed(state: GameState, player: PlayerIndex): number {
  return 800_000 + state.handNumber * 1_000 + state.moveLog.length * 10 + player;
}
