import {
  cardId,
  effectiveSuit,
  isLeftBower,
  isRightBower,
  isTrump,
  rankPower,
  sameCard
} from "./cards";
import { nextPlayer, teamOf } from "./deck";
import { SUITS, type Card, type GameState, type LegalActionSummary, type Play, type PlayerIndex, type Suit, type TeamIndex, type Trick } from "./types";

export function getLedSuit(trick: Trick, trump: Suit): Suit | null {
  const lead = trick.plays[0];
  return lead ? effectiveSuit(lead.card, trump) : null;
}

export function hasSuit(cards: Card[], suit: Suit, trump: Suit): boolean {
  return cards.some((card) => effectiveSuit(card, trump) === suit);
}

export function canPlayCard(hand: Card[], card: Card, trick: Trick | null, trump: Suit): boolean {
  if (!hand.some((candidate) => sameCard(candidate, card))) {
    return false;
  }

  if (!trick || trick.plays.length === 0) {
    return true;
  }

  const ledSuit = getLedSuit(trick, trump);
  if (!ledSuit || !hasSuit(hand, ledSuit, trump)) {
    return true;
  }

  return effectiveSuit(card, trump) === ledSuit;
}

export function playableCards(hand: Card[], trick: Trick | null, trump: Suit): Card[] {
  return hand.filter((card) => canPlayCard(hand, card, trick, trump));
}

export function isFarmersHandQualifier(hand: Card[]): boolean {
  return hand.length > 0 && hand.every((card) => card.rank === "9" || card.rank === "10");
}

export function farmersHandReplaceableCards(hand: Card[]): Card[] {
  return hand.filter((card) => card.rank === "9" || card.rank === "10");
}

export function cardTrickPower(card: Card, trump: Suit, ledSuit: Suit): number {
  if (isRightBower(card, trump)) {
    return 200;
  }

  if (isLeftBower(card, trump)) {
    return 199;
  }

  if (isTrump(card, trump)) {
    return 100 + rankPower(card.rank);
  }

  if (effectiveSuit(card, trump) === ledSuit) {
    return rankPower(card.rank);
  }

  return 0;
}

export function determineTrickWinner(trick: Trick, trump: Suit): PlayerIndex {
  if (trick.plays.length !== 4) {
    throw new Error("A trick needs four cards before a winner can be determined");
  }

  const ledSuit = getLedSuit(trick, trump);
  if (!ledSuit) {
    throw new Error("Cannot determine a trick winner without a led suit");
  }

  return trick.plays.reduce((best, play) => {
    const bestPower = cardTrickPower(best.card, trump, ledSuit);
    const candidatePower = cardTrickPower(play.card, trump, ledSuit);
    return candidatePower > bestPower ? play : best;
  }).player;
}

export function scoreHand({
  makerTeam,
  maker,
  trump,
  tricksWon,
  lonePlayer
}: {
  makerTeam: TeamIndex;
  maker: PlayerIndex;
  trump: Suit;
  tricksWon: [number, number];
  lonePlayer?: PlayerIndex;
}) {
  const makerTricks = tricksWon[makerTeam];
  const defenderTeam = makerTeam === 0 ? 1 : 0;
  const pointsAwarded: [number, number] = [0, 0];
  const lone = lonePlayer !== undefined;
  const euchred = makerTricks < 3;
  const march = makerTricks === 5;

  if (euchred) {
    pointsAwarded[defenderTeam] = 2;
  } else if (lone && march) {
    pointsAwarded[makerTeam] = 4;
  } else if (march) {
    pointsAwarded[makerTeam] = 2;
  } else {
    pointsAwarded[makerTeam] = 1;
  }

  return {
    makers: makerTeam,
    maker,
    trump,
    tricksWon,
    pointsAwarded,
    lone,
    euchred,
    march
  };
}

export function nextPlayerInTrick(trick: Trick): PlayerIndex {
  let player = trick.leader;
  for (let index = 0; index < trick.plays.length; index += 1) {
    player = nextPlayer(player);
  }
  return player;
}

export function assertPlayOrder(trick: Trick, player: PlayerIndex): void {
  const expected = nextPlayerInTrick(trick);
  if (player !== expected) {
    throw new Error(`Player ${player} cannot play now; expected player ${expected}`);
  }
}

export function validateUniquePlay(trick: Trick, play: Play): void {
  if (trick.plays.some((candidate) => candidate.player === play.player)) {
    throw new Error(`Player ${play.player} has already played in this trick`);
  }
}

export function legalActionsForPlayer(state: GameState, player: PlayerIndex): LegalActionSummary {
  const active = state.activePlayer === player;
  const hand = state.hands[player];
  const orderPasses = state.bids.filter((bid) => bid.round === 1 && bid.decision === "pass").length;
  const callPasses = state.bids.filter((bid) => bid.round === 2 && bid.decision === "pass").length;
  const dealerMustStick = state.config.stickDealer && state.phase === "calling" && player === state.dealer && callPasses === 3;
  const canCheckFarmersHand = state.phase === "farmersHand" || state.phase === "ordering" || state.phase === "calling";
  const canClaimFarmersHand = active && canCheckFarmersHand && state.config.farmersHandMode !== "off" && isFarmersHandQualifier(hand);

  return {
    canClaimFarmersHand,
    canDeclineFarmersHand: active && state.phase === "farmersHand" && canClaimFarmersHand,
    farmersHandReplaceableCards:
      canClaimFarmersHand && state.config.farmersHandMode === "replaceThree"
        ? farmersHandReplaceableCards(hand)
        : [],
    canPass: active && (state.phase === "ordering" || state.phase === "calling") && !dealerMustStick,
    canOrderUp: active && state.phase === "ordering" && orderPasses < 4,
    callableSuits:
      active && state.phase === "calling"
        ? SUITS.filter((suit) => suit !== state.turnedDownSuit)
        : [],
    playableCards:
      active && state.phase === "playing" && state.trump
        ? playableCards(hand, state.currentTrick, state.trump)
        : [],
    mustDiscard: active && state.phase === "discarding"
  };
}

export function validateCardInHand(hand: Card[], card: Card): void {
  if (!hand.some((candidate) => sameCard(candidate, card))) {
    throw new Error(`Card ${cardId(card)} is not in hand`);
  }
}

export function validCallerSuits(turnedDownSuit: Suit): Suit[] {
  return SUITS.filter((suit) => suit !== turnedDownSuit);
}

export function isTeamPlayer(player: PlayerIndex, team: TeamIndex): boolean {
  return teamOf(player) === team;
}
