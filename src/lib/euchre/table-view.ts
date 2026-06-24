import { cardId, cardLabel, effectiveSuit, isTrump, rankPower } from "./cards";
import { nextPlayer, partnerOf, teamOf } from "./deck";
import { buildLegalActionExplanation, formatRecentBotAction } from "./game-ux";
import { cardTrickPower, legalActionsForPlayer } from "./rules";
import type { Card, GameState, MoveEvent, Phase, Play, PlayerIndex, Suit, TeamIndex } from "./types";

export const TABLE_SEATS = [0, 1, 2, 3] as const satisfies PlayerIndex[];

export const TABLE_PLAYER_NAMES: Record<PlayerIndex, string> = {
  0: "South",
  1: "West",
  2: "North",
  3: "East"
};

export type TableSeatPosition = "south" | "west" | "north" | "east";

export interface TableSeatView {
  seat: PlayerIndex;
  name: string;
  position: TableSeatPosition;
  team: TeamIndex;
  isHuman: boolean;
  isDealer: boolean;
  isActive: boolean;
  isMaker: boolean;
  isCaller: boolean;
  isPartnerOfCaller: boolean;
  cardCount: number;
  recentAction?: string;
}

export interface TableStatusView {
  handLabel: string;
  scoreLabel: string;
  targetLabel: string;
  scores: [number, number];
  phaseLabel: string;
  dealerLabel: string;
  activePlayerLabel: string;
  trumpLabel: string;
  upcardLabel: string;
  makersLabel: string;
  trickScoreLabel: string;
}

export interface TableCardView {
  card: Card;
  id: string;
  label: string;
  legal: boolean;
  farmersHandEligible: boolean;
}

export interface EuchreScoreCardView {
  cardNumber: 1 | 2;
  pointsVisible: number;
}

export interface EuchreTeamScoreView {
  team: TeamIndex;
  score: number;
  label: string;
  cards: [EuchreScoreCardView, EuchreScoreCardView];
}

export interface ScoreFiveCard {
  suit: "hearts" | "diamonds" | "spades" | "clubs";
  color: "red" | "black";
  cardLabel: "5H" | "5D" | "5S" | "5C";
  role: "base" | "cover" | "bonus";
  faceUp: boolean;
  visiblePips: number;
  coveredPips: number;
  isBaseFive: boolean;
  isComplete: boolean;
  state: "unused" | "partial" | "complete";
}

export interface FiveCardScoreView {
  teamColor: "red" | "black";
  cards: [ScoreFiveCard, ScoreFiveCard];
  score: number;
  clampedScore: number;
  isWinningScore: boolean;
  accessibleLabel: string;
}

export interface HumanHandView {
  seat: PlayerIndex;
  cards: TableCardView[];
  actionLabel: string;
  helperText: string;
  detailText?: string;
  mustDiscard: boolean;
}

export interface TablePlayView {
  seat: PlayerIndex;
  playerName: string;
  card: Card;
  cardId: string;
  cardLabel: string;
  effectiveSuit?: Suit;
  isTrump: boolean;
  isLeader: boolean;
  isWinningCard: boolean;
}

export interface CurrentTrickView {
  trickNumber: number;
  isShowingCompletedTrick: boolean;
  leaderSeat?: PlayerIndex;
  leaderLabel: string;
  nextLeaderSeat?: PlayerIndex;
  nextLeaderLabel?: string;
  ledSuitLabel: string;
  trumpLabel: string;
  plays: TablePlayView[];
  unplayedSeats: PlayerIndex[];
  currentWinnerSeat?: PlayerIndex;
  currentWinnerLabel?: string;
  winningCardLabel?: string;
  latestCompletedWinnerLabel?: string;
}

export function buildTableSeatViews(state: GameState): TableSeatView[] {
  return TABLE_SEATS.map((seat) => {
    const recentAction = seat === 0 ? undefined : recentActionForSeat(state.moveLog, seat);
    const isCaller = state.maker === seat;
    const isPartnerOfCaller = state.maker !== undefined && partnerOf(state.maker) === seat;

    return {
      seat,
      name: TABLE_PLAYER_NAMES[seat],
      position: seatPosition(seat),
      team: teamOf(seat),
      isHuman: seat === 0,
      isDealer: state.dealer === seat,
      isActive: state.activePlayer === seat && state.phase !== "idle",
      isMaker: state.makerTeam !== undefined && teamOf(seat) === state.makerTeam,
      isCaller,
      isPartnerOfCaller,
      cardCount: state.hands[seat]?.length ?? 0,
      recentAction
    };
  });
}

export function buildTableStatusView(state: GameState): TableStatusView {
  return {
    handLabel: state.handNumber ? `Hand ${state.handNumber}` : "No hand dealt",
    scoreLabel: `Team 0 ${state.scores[0]} - ${state.scores[1]} Team 1`,
    targetLabel: `First to ${state.config.targetScore}`,
    scores: [...state.scores],
    phaseLabel: formatPhase(state.phase),
    dealerLabel: TABLE_PLAYER_NAMES[state.dealer],
    activePlayerLabel: state.phase === "idle" ? "None" : TABLE_PLAYER_NAMES[state.activePlayer],
    trumpLabel: state.trump ?? "Not set",
    upcardLabel: state.upcard ? cardLabel(state.upcard) : "None",
    makersLabel: state.makerTeam === undefined ? "None" : `Team ${state.makerTeam}`,
    trickScoreLabel: `${state.tricksWon[0]} - ${state.tricksWon[1]}`
  };
}

export function buildEuchreScoreCardViews(scores: [number, number]): [EuchreTeamScoreView, EuchreTeamScoreView] {
  return [0, 1].map((team) => {
    const score = scores[team];
    const clampedScore = Math.max(0, Math.min(score, 10));
    const firstCard = Math.min(clampedScore, 5);
    const secondCard = Math.max(0, clampedScore - 5);

    return {
      team,
      score,
      label: `Team ${team}`,
      cards: [
        { cardNumber: 1, pointsVisible: firstCard },
        { cardNumber: 2, pointsVisible: secondCard }
      ]
    };
  }) as [EuchreTeamScoreView, EuchreTeamScoreView];
}

export function buildFiveCardScoreView(score: number, teamColor: "red" | "black"): FiveCardScoreView {
  const clampedScore = Math.max(0, Math.min(score, 10));
  const firstCardVisible = Math.min(clampedScore, 5);
  const secondCardVisible = Math.max(0, clampedScore - 5);
  const suits: [ScoreFiveCard["suit"], ScoreFiveCard["suit"]] = teamColor === "red"
    ? ["hearts", "diamonds"]
    : ["spades", "clubs"];
  const labels: [ScoreFiveCard["cardLabel"], ScoreFiveCard["cardLabel"]] = teamColor === "red"
    ? ["5H", "5D"]
    : ["5S", "5C"];

  return {
    teamColor,
    score,
    clampedScore,
    isWinningScore: clampedScore >= 10,
    accessibleLabel: `${teamColor === "red" ? "North/South" : "East/West"} team score: ${clampedScore}`,
    cards: [
      {
        suit: suits[0],
        color: teamColor,
        cardLabel: labels[0],
        role: "base",
        faceUp: clampedScore > 0,
        visiblePips: firstCardVisible,
        coveredPips: 5 - firstCardVisible,
        isBaseFive: firstCardVisible === 5,
        isComplete: firstCardVisible === 5,
        state: firstCardVisible === 0 ? "unused" : firstCardVisible === 5 ? "complete" : "partial"
      },
      {
        suit: suits[1],
        color: teamColor,
        cardLabel: labels[1],
        role: clampedScore <= 5 ? "cover" : "bonus",
        faceUp: clampedScore > 5,
        visiblePips: secondCardVisible,
        coveredPips: 5 - secondCardVisible,
        isBaseFive: false,
        isComplete: secondCardVisible === 5,
        state: secondCardVisible === 0 ? "unused" : secondCardVisible === 5 ? "complete" : "partial"
      }
    ]
  };
}

export function buildHumanHandView(state: GameState, seat: PlayerIndex = 0): HumanHandView {
  const legal = legalActionsForPlayer(state, seat);
  const playable = new Set(legal.playableCards.map(cardId));
  const farmersHandEligible = new Set(legal.farmersHandReplaceableCards.map(cardId));
  const explanation = buildLegalActionExplanation(state, seat);
  const mustDiscard = legal.mustDiscard;
  const canSelectFarmersHandReplacement = (state.phase === "farmersHand" || state.phase === "ordering" || state.phase === "calling")
    && state.activePlayer === seat
    && legal.canClaimFarmersHand
    && state.config.farmersHandMode === "replaceThree";

  return {
    seat,
    cards: sortCardsForTableHand(state.hands[seat] ?? [], state.trump).map((card) => ({
      card,
      id: cardId(card),
      label: cardLabel(card),
      legal: mustDiscard || playable.has(cardId(card)) || (canSelectFarmersHandReplacement && farmersHandEligible.has(cardId(card))),
      farmersHandEligible: farmersHandEligible.has(cardId(card))
    })),
    actionLabel: mustDiscard
      ? "Choose a discard"
      : canSelectFarmersHandReplacement
        ? "Choose Farmer's Hand replacements"
        : "Your hand",
    helperText: explanation.primary,
    detailText: explanation.details.length ? explanation.details.join(" ") : undefined,
    mustDiscard
  };
}

export function buildCurrentTrickView(state: GameState, options: { showLatestCompleted?: boolean } = {}): CurrentTrickView {
  const latestCompleted = state.completedTricks[state.completedTricks.length - 1];
  const showingCompleted = Boolean(options.showLatestCompleted && latestCompleted);
  const trick = showingCompleted ? latestCompleted : state.currentTrick;
  const plays = trick?.plays ?? [];
  const trump = state.trump;
  const ledSuit = trick && trump ? ledSuitForPlays(plays, trump) : undefined;
  const currentWinner = showingCompleted && latestCompleted?.winner !== undefined
    ? latestCompleted.plays.find((play) => play.player === latestCompleted.winner)
    : trump && ledSuit && plays.length
      ? bestPlaySoFar(plays, trump, ledSuit)
      : undefined;
  const trickNumber = showingCompleted
    ? Math.max(state.completedTricks.length, 1)
    : state.phase === "playing" && trick
    ? Math.min(state.completedTricks.length + 1, 5)
    : Math.min(Math.max(state.completedTricks.length, 1), 5);

  return {
    trickNumber,
    isShowingCompletedTrick: showingCompleted,
    leaderSeat: trick?.leader,
    leaderLabel: trick ? TABLE_PLAYER_NAMES[trick.leader] : "Not started",
    nextLeaderSeat: showingCompleted ? state.currentTrick?.leader : undefined,
    nextLeaderLabel: showingCompleted && state.currentTrick ? TABLE_PLAYER_NAMES[state.currentTrick.leader] : undefined,
    ledSuitLabel: ledSuit ?? "Not led",
    trumpLabel: trump ?? "Not set",
    plays: plays.map((play) => ({
      seat: play.player,
      playerName: TABLE_PLAYER_NAMES[play.player],
      card: play.card,
      cardId: cardId(play.card),
      cardLabel: cardLabel(play.card),
      effectiveSuit: trump ? effectiveSuit(play.card, trump) : undefined,
      isTrump: trump ? isTrump(play.card, trump) : false,
      isLeader: trick?.leader === play.player,
      isWinningCard: currentWinner?.player === play.player && cardId(currentWinner.card) === cardId(play.card)
    })),
    unplayedSeats: showingCompleted ? [] : trick ? unplayedSeats(trick.leader, plays) : [...TABLE_SEATS],
    currentWinnerSeat: currentWinner?.player,
    currentWinnerLabel: currentWinner ? TABLE_PLAYER_NAMES[currentWinner.player] : undefined,
    winningCardLabel: currentWinner ? cardLabel(currentWinner.card) : undefined,
    latestCompletedWinnerLabel: latestCompleted?.winner === undefined ? undefined : TABLE_PLAYER_NAMES[latestCompleted.winner]
  };
}

function recentActionForSeat(events: MoveEvent[], seat: PlayerIndex): string | undefined {
  const event = [...events].reverse().find((candidate) => candidate.player === seat);
  return event ? formatRecentBotAction(event) : undefined;
}

function seatPosition(seat: PlayerIndex): TableSeatPosition {
  const positions: Record<PlayerIndex, TableSeatPosition> = {
    0: "south",
    1: "west",
    2: "north",
    3: "east"
  };
  return positions[seat];
}

function ledSuitForPlays(plays: Play[], trump: Suit): Suit | undefined {
  const lead = plays[0];
  return lead ? effectiveSuit(lead.card, trump) : undefined;
}

function bestPlaySoFar(plays: Play[], trump: Suit, ledSuit: Suit): Play | undefined {
  return plays.reduce<Play | undefined>((best, play) => {
    if (!best) {
      return play;
    }

    return cardTrickPower(play.card, trump, ledSuit) > cardTrickPower(best.card, trump, ledSuit) ? play : best;
  }, undefined);
}

function unplayedSeats(leader: PlayerIndex, plays: Play[]): PlayerIndex[] {
  const played = new Set(plays.map((play) => play.player));
  const seats: PlayerIndex[] = [];
  let seat = leader;

  for (let index = 0; index < 4; index += 1) {
    if (!played.has(seat)) {
      seats.push(seat);
    }
    seat = nextPlayer(seat);
  }

  return seats;
}

function formatPhase(phase: Phase): string {
  return phase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function sortCardsForTableHand(cards: Card[], trump?: Suit): Card[] {
  return [...cards].sort((a, b) => {
    const suitComparison = displaySuitOrder(a, trump) - displaySuitOrder(b, trump);
    if (suitComparison !== 0) {
      return suitComparison;
    }

    const aSuit = effectiveSuit(a, trump);
    const bSuit = effectiveSuit(b, trump);
    const aPower = trump ? cardTrickPower(a, trump, aSuit) : rankPower(a.rank);
    const bPower = trump ? cardTrickPower(b, trump, bSuit) : rankPower(b.rank);
    if (aPower !== bPower) {
      return bPower - aPower;
    }

    return cardId(a).localeCompare(cardId(b));
  });
}

function displaySuitOrder(card: Card, trump?: Suit): number {
  const suit = effectiveSuit(card, trump);
  const baseOrder: Suit[] = trump
    ? [trump, ...(["spades", "hearts", "diamonds", "clubs"] as Suit[]).filter((candidate) => candidate !== trump)]
    : ["spades", "hearts", "diamonds", "clubs"];

  return baseOrder.indexOf(suit);
}
