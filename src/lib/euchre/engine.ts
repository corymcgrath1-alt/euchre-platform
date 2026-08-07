import { compareCardsForSort, removeCard, sameCard } from "./cards";
import { dealHands, nextPlayer, teamOf } from "./deck";
import {
  farmersHandReplaceableCards,
  canPlayCard,
  determineTrickWinner,
  isFarmersHandQualifier,
  nextActivePlayer,
  scoreHand,
  trickPlayerCount,
  validateCardInHand,
  validCallerSuits
} from "./rules";
import type {
  BidDecision,
  Card,
  GameAction,
  GameConfig,
  GameState,
  MoveEvent,
  PlayerIndex,
  Suit,
  Trick
} from "./types";

const DEFAULT_CONFIG: GameConfig = {
  stickDealer: false,
  targetScore: 10,
  botDifficulty: "standard",
  dealerSelection: "default",
  farmersHandMode: "off",
  lonerMode: "aloneOnly"
};

export class InvalidGameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameActionError";
  }
}

export function createInitialGameState(config: Partial<GameConfig> = {}): GameState {
  const normalizedConfig = normalizeGameConfig(config);
  const initialDealer = initialDealerForConfig(normalizedConfig);

  return {
    id: cryptoSafeId(),
    config: normalizedConfig,
    phase: "idle",
    handNumber: 0,
    dealer: initialDealer,
    activePlayer: nextPlayer(initialDealer),
    scores: [0, 0],
    hands: {
      0: [],
      1: [],
      2: [],
      3: []
    },
    kitty: [],
    farmersHandDeclines: [],
    bids: [],
    currentTrick: null,
    completedTricks: [],
    tricksWon: [0, 0],
    moveLog: []
  };
}

export function normalizeGameConfig(config: Partial<GameConfig> = {}): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    targetScore: config.targetScore ?? DEFAULT_CONFIG.targetScore,
    botDifficulty: config.botDifficulty ?? DEFAULT_CONFIG.botDifficulty,
    dealerSelection: config.dealerSelection ?? DEFAULT_CONFIG.dealerSelection,
    farmersHandMode: config.farmersHandMode ?? DEFAULT_CONFIG.farmersHandMode,
    lonerMode: config.lonerMode ?? DEFAULT_CONFIG.lonerMode
  };
}

export function createMoveEvent(action: GameAction, sequence: number): MoveEvent {
  return {
    id: `move_${sequence}_${Date.now()}`,
    sequence,
    action,
    player: "player" in action ? action.player : undefined,
    createdAt: new Date().toISOString()
  };
}

export function applyMoveEvent(state: GameState, event: MoveEvent): GameState {
  const nextState = reduceGameAction(state, event.action);
  return {
    ...nextState,
    moveLog: [...nextState.moveLog, event]
  };
}

export function dispatchAction(state: GameState, action: GameAction): GameState {
  return applyMoveEvent(state, createMoveEvent(action, state.moveLog.length));
}

export function replayMoveLog(events: MoveEvent[], config: Partial<GameConfig> = {}): GameState {
  return events.reduce((state, event) => applyMoveEvent(state, event), createInitialGameState(config));
}

export function reduceGameAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESET_GAME":
      return createInitialGameState(state.config);
    case "START_HAND":
      if (state.phase !== "idle") {
        throw new InvalidGameActionError("A new game hand can only start from idle");
      }
      return startHand(state, state.dealer, action.seed, state.handNumber + 1);
    case "FARMERS_HAND_DECLINE":
      return declineFarmersHand(state, action.player);
    case "FARMERS_HAND_REDEAL":
      return redealFarmersHand(state, action.player, action.seed);
    case "FARMERS_HAND_REPLACE":
      return replaceFarmersHandCards(state, action.player, action.cards);
    case "NEXT_HAND":
      if (state.phase !== "handComplete" && state.phase !== "gameComplete") {
        throw new InvalidGameActionError("The next hand can only start after a hand is complete");
      }
      if (state.phase === "gameComplete") {
        throw new InvalidGameActionError("The game is already complete");
      }
      return startHand(state, nextPlayer(state.dealer), action.seed, state.handNumber + 1);
    case "PASS":
      return pass(state, action.player);
    case "ORDER_UP":
      return orderUp(state, action.player, Boolean(action.alone));
    case "CALL_TRUMP":
      return callTrump(state, action.player, action.suit, Boolean(action.alone));
    case "DISCARD":
      return discard(state, action.player, action.card);
    case "PLAY_CARD":
      return playCard(state, action.player, action.card);
    default:
      return assertNever(action);
  }
}

function startHand(state: GameState, dealer: PlayerIndex, seed: number, handNumber: number): GameState {
  const dealt = dealHands(seed);
  const sortedHands = sortHands(dealt.hands);
  const upcard = dealt.kitty[0];

  return {
    ...state,
    phase: "ordering",
    handNumber,
    dealer,
    activePlayer: nextPlayer(dealer),
    hands: sortedHands,
    kitty: dealt.kitty,
    upcard,
    turnedDownSuit: upcard.suit,
    trump: undefined,
    maker: undefined,
    makerTeam: undefined,
    lonePlayer: undefined,
    farmersHandDeclines: [],
    bids: [],
    currentTrick: null,
    completedTricks: [],
    tricksWon: [0, 0],
    handResult: undefined
  };
}

function declineFarmersHand(state: GameState, player: PlayerIndex): GameState {
  assertActivePlayer(state, player);
  assertFarmersHandPhase(state);
  if (!isFarmersHandQualifier(state.hands[player])) {
    throw new InvalidGameActionError("Player does not qualify for farmer's hand");
  }

  const farmersHandDeclines = state.farmersHandDeclines.includes(player)
    ? state.farmersHandDeclines
    : [...state.farmersHandDeclines, player];
  const nextQualifier = nextQualifyingFarmersHandPlayer(state.hands, nextPlayer(player), farmersHandDeclines);

  if (nextQualifier === undefined) {
    return {
      ...state,
      phase: "ordering",
      activePlayer: nextPlayer(state.dealer),
      farmersHandDeclines
    };
  }

  return {
    ...state,
    activePlayer: nextQualifier,
    farmersHandDeclines
  };
}

function redealFarmersHand(state: GameState, player: PlayerIndex, seed: number): GameState {
  assertActivePlayer(state, player);
  assertFarmersHandPhase(state);
  if (state.config.farmersHandMode !== "redeal") {
    throw new InvalidGameActionError("Farmer's hand redeal is not enabled");
  }
  if (!isFarmersHandQualifier(state.hands[player])) {
    throw new InvalidGameActionError("Player does not qualify for farmer's hand");
  }

  return startHand(state, state.dealer, seed, state.handNumber);
}

function replaceFarmersHandCards(state: GameState, player: PlayerIndex, cards: Card[]): GameState {
  assertActivePlayer(state, player);
  assertFarmersHandPhase(state);
  if (state.config.farmersHandMode !== "replaceThree") {
    throw new InvalidGameActionError("Farmer's hand replacement is not enabled");
  }
  if (!isFarmersHandQualifier(state.hands[player])) {
    throw new InvalidGameActionError("Player does not qualify for farmer's hand");
  }
  if (cards.length < 1 || cards.length > 3) {
    throw new InvalidGameActionError("Farmer's hand replacement must exchange one to three cards");
  }
  if (new Set(cards.map(cardKey)).size !== cards.length) {
    throw new InvalidGameActionError("Farmer's hand replacement cards must be unique");
  }
  if (cards.length > Math.max(0, state.kitty.length - 1)) {
    throw new InvalidGameActionError("Not enough kitty cards for farmer's hand replacement");
  }

  const replaceableIds = new Set(farmersHandReplaceableCards(state.hands[player]).map(cardKey));
  const handIds = new Set(state.hands[player].map(cardKey));
  for (const card of cards) {
    if (!handIds.has(cardKey(card))) {
      throw new InvalidGameActionError("Farmer's hand replacement cards must be in the player's hand");
    }
    if (!replaceableIds.has(cardKey(card))) {
      throw new InvalidGameActionError("Farmer's hand replacement cards must be 9s or 10s");
    }
  }

  const replacementCards = state.kitty.slice(1, 1 + cards.length);
  const remainingKitty = state.kitty.slice(1 + cards.length);
  const updatedHand = cards.reduce((hand, card) => removeCard(hand, card), state.hands[player]);

  return {
    ...state,
    phase: "ordering",
    activePlayer: nextPlayer(state.dealer),
    hands: {
      ...state.hands,
      [player]: [...updatedHand, ...replacementCards].sort(compareCardsForSort)
    },
    kitty: [state.kitty[0], ...cards, ...remainingKitty],
    farmersHandDeclines: []
  };
}

function pass(state: GameState, player: PlayerIndex): GameState {
  assertActivePlayer(state, player);

  if (state.phase === "ordering") {
    const bids = [...state.bids, bid(1, player, "pass")];
    if (bids.filter((candidate) => candidate.round === 1 && candidate.decision === "pass").length === 4) {
      return {
        ...state,
        phase: "calling",
        activePlayer: nextPlayer(state.dealer),
        bids
      };
    }

    return {
      ...state,
      activePlayer: nextPlayer(player),
      bids
    };
  }

  if (state.phase === "calling") {
    const roundTwoPasses = state.bids.filter((candidate) => candidate.round === 2 && candidate.decision === "pass").length;
    if (state.config.stickDealer && player === state.dealer && roundTwoPasses === 3) {
      throw new Error("Stick the dealer is enabled; dealer must call trump");
    }

    const bids = [...state.bids, bid(2, player, "pass")];
    if (bids.filter((candidate) => candidate.round === 2 && candidate.decision === "pass").length === 4) {
      return {
        ...state,
        phase: "handComplete",
        activePlayer: nextPlayer(state.dealer),
        bids,
        handResult: undefined
      };
    }

    return {
      ...state,
      activePlayer: nextPlayer(player),
      bids
    };
  }

  throw new Error(`Cannot pass during ${state.phase}`);
}

function orderUp(state: GameState, player: PlayerIndex, alone: boolean): GameState {
  assertActivePlayer(state, player);
  assertPhase(state, "ordering");
  if (!state.upcard) {
    throw new Error("Cannot order up without an upcard");
  }

  const dealerHand = [...state.hands[state.dealer], state.upcard].sort(compareCardsForSort);

  return {
    ...state,
    phase: "discarding",
    activePlayer: state.dealer,
    trump: state.upcard.suit,
    maker: player,
    makerTeam: teamOf(player),
    lonePlayer: alone ? player : undefined,
    hands: {
      ...state.hands,
      [state.dealer]: dealerHand
    },
    bids: [...state.bids, bid(1, player, "order-up", state.upcard.suit, alone)]
  };
}

function callTrump(state: GameState, player: PlayerIndex, suit: Suit, alone: boolean): GameState {
  assertActivePlayer(state, player);
  assertPhase(state, "calling");
  if (!state.turnedDownSuit) {
    throw new Error("Cannot call trump without a turned down suit");
  }
  if (!validCallerSuits(state.turnedDownSuit).includes(suit)) {
    throw new Error(`Cannot call ${suit}; ${state.turnedDownSuit} was turned down`);
  }

  return beginPlay({
    ...state,
    trump: suit,
    maker: player,
    makerTeam: teamOf(player),
    lonePlayer: alone ? player : undefined,
    bids: [...state.bids, bid(2, player, "call", suit, alone)]
  });
}

function discard(state: GameState, player: PlayerIndex, card: Card): GameState {
  assertActivePlayer(state, player);
  assertPhase(state, "discarding");
  if (player !== state.dealer) {
    throw new Error("Only the dealer can discard after pickup");
  }
  validateCardInHand(state.hands[player], card);

  const dealerHand = removeCard(state.hands[player], card).sort(compareCardsForSort);
  if (dealerHand.length !== 5) {
    throw new Error("Dealer must discard back to five cards");
  }

  return beginPlay({
    ...state,
    hands: {
      ...state.hands,
      [player]: dealerHand
    }
  });
}

function beginPlay(state: GameState): GameState {
  if (!state.trump || state.maker === undefined || state.makerTeam === undefined) {
    throw new Error("Cannot begin play without trump and makers");
  }

  const leader = nextActivePlayer(state.dealer, state.lonePlayer);
  return {
    ...state,
    phase: "playing",
    activePlayer: leader,
    currentTrick: {
      leader,
      plays: []
    }
  };
}

function playCard(state: GameState, player: PlayerIndex, card: Card): GameState {
  assertActivePlayer(state, player);
  assertPhase(state, "playing");
  if (!state.trump || !state.currentTrick) {
    throw new Error("Cannot play before trump and trick are set");
  }

  if (!canPlayCard(state.hands[player], card, state.currentTrick, state.trump)) {
    throw new Error("Illegal play: player must follow suit when able");
  }

  const updatedHands = {
    ...state.hands,
    [player]: removeCard(state.hands[player], card)
  };
  const currentTrick: Trick = {
    ...state.currentTrick,
    plays: [...state.currentTrick.plays, { player, card }]
  };

  if (currentTrick.plays.length < trickPlayerCount(state.lonePlayer)) {
    return {
      ...state,
      hands: updatedHands,
      currentTrick,
      activePlayer: nextActivePlayer(player, state.lonePlayer)
    };
  }

  const winner = determineTrickWinner(currentTrick, state.trump);
  const completedTrick = {
    ...currentTrick,
    winner
  };
  const winnerTeam = teamOf(winner);
  const tricksWon: [number, number] = [...state.tricksWon];
  tricksWon[winnerTeam] += 1;
  const completedTricks = [...state.completedTricks, completedTrick];

  if (completedTricks.length === 5) {
    return completeHand({
      ...state,
      hands: updatedHands,
      completedTricks,
      tricksWon,
      currentTrick: null,
      activePlayer: winner
    });
  }

  return {
    ...state,
    hands: updatedHands,
    completedTricks,
    tricksWon,
    currentTrick: {
      leader: winner,
      plays: []
    },
    activePlayer: winner
  };
}

function completeHand(state: GameState): GameState {
  if (!state.trump || state.maker === undefined || state.makerTeam === undefined) {
    throw new Error("Cannot score a hand without trump and makers");
  }

  const handResult = scoreHand({
    makerTeam: state.makerTeam,
    maker: state.maker,
    trump: state.trump,
    tricksWon: state.tricksWon,
    lonePlayer: state.lonePlayer
  });
  const scores: [number, number] = [
    state.scores[0] + handResult.pointsAwarded[0],
    state.scores[1] + handResult.pointsAwarded[1]
  ];

  return {
    ...state,
    phase: scores.some((score) => score >= state.config.targetScore) ? "gameComplete" : "handComplete",
    scores,
    handResult
  };
}

function sortHands(hands: Record<PlayerIndex, Card[]>): Record<PlayerIndex, Card[]> {
  return {
    0: [...hands[0]].sort(compareCardsForSort),
    1: [...hands[1]].sort(compareCardsForSort),
    2: [...hands[2]].sort(compareCardsForSort),
    3: [...hands[3]].sort(compareCardsForSort)
  };
}

function bid(
  round: 1 | 2,
  player: PlayerIndex,
  decision: BidDecision["decision"],
  suit?: Suit,
  alone?: boolean
): BidDecision {
  return {
    round,
    player,
    decision,
    suit,
    alone
  };
}

function assertActivePlayer(state: GameState, player: PlayerIndex): void {
  if (state.activePlayer !== player) {
    throw new Error(`Player ${player} cannot act now; expected player ${state.activePlayer}`);
  }
}

function assertPhase(state: GameState, phase: GameState["phase"]): void {
  if (state.phase !== phase) {
    throw new Error(`Expected phase ${phase}; got ${state.phase}`);
  }
}

function assertFarmersHandPhase(state: GameState): void {
  if (state.phase !== "farmersHand" && state.phase !== "ordering" && state.phase !== "calling") {
    throw new Error(`Expected Farmer's Hand check during bidding; got ${state.phase}`);
  }
}

function initialDealerForConfig(config: GameConfig): PlayerIndex {
  switch (config.dealerSelection) {
    case "human":
    case "seat0":
    case "default":
      return 0;
    case "seat1":
      return 1;
    case "seat2":
      return 2;
    case "seat3":
      return 3;
    default:
      return 0;
  }
}

function nextQualifyingFarmersHandPlayer(
  hands: Record<PlayerIndex, Card[]>,
  start: PlayerIndex,
  skipped: PlayerIndex[]
): PlayerIndex | undefined {
  const skippedSeats = new Set(skipped);
  let player = start;

  for (let index = 0; index < 4; index += 1) {
    if (!skippedSeats.has(player) && isFarmersHandQualifier(hands[player])) {
      return player;
    }
    player = nextPlayer(player);
  }

  return undefined;
}

function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

function cryptoSafeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `game_${Date.now()}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}

export function findCard(hand: Card[], card: Card): Card {
  const found = hand.find((candidate) => sameCard(candidate, card));
  if (!found) {
    throw new Error("Card not found");
  }
  return found;
}
