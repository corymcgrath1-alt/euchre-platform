import {
  buildCurrentTrickView,
  buildEuchreScoreCardViews,
  buildHumanHandView,
  buildTableSeatViews,
  buildTableStatusView,
  cardId,
  legalActionsForPlayer,
  partnerOf,
  type BidDecision,
  type Card,
  type CurrentTrickView,
  type GameState,
  type Phase,
  type PlayerIndex,
  type Suit,
  type TableCardView,
  type TeamIndex
} from "@/lib/euchre";

export type ClubTablePosition = "south" | "west" | "north" | "east";

export interface ClubTableSeatView {
  seat: PlayerIndex;
  position: ClubTablePosition;
  displayName: string;
  partnership: TeamIndex;
  cardCount: number;
  isViewer: boolean;
  isDealer: boolean;
  isActive: boolean;
  isMakerPartnership: boolean;
  isCaller: boolean;
  isPartnerOfCaller: boolean;
  isSittingOut: boolean;
  recentAction?: string;
}

export interface ClubTableLegalView {
  canClaimFarmersHand: boolean;
  canDeclineFarmersHand: boolean;
  canPass: boolean;
  canOrderUp: boolean;
  callableSuits: Suit[];
  playableCardIds: string[];
  selectableCardIds: string[];
  farmersHandReplaceableCardIds: string[];
  mustDiscard: boolean;
}

export interface ClubTableView {
  viewerSeat: PlayerIndex;
  phase: Phase;
  dealer: PlayerIndex;
  activePlayer: PlayerIndex;
  maker?: PlayerIndex;
  makerPartnership?: TeamIndex;
  trump?: Suit;
  lonePlayer?: PlayerIndex;
  sittingOutPartner?: PlayerIndex;
  scores: [number, number];
  status: ReturnType<typeof buildTableStatusView>;
  scoreCards: ReturnType<typeof buildEuchreScoreCardViews>;
  seats: ClubTableSeatView[];
  viewerHand: {
    cards: TableCardView[];
    actionLabel: string;
    helperText: string;
    detailText?: string;
  };
  legal: ClubTableLegalView;
  bids: BidDecision[];
  currentTrick: CurrentTrickView;
}

export function buildClubTableView(state: GameState, viewerSeat: PlayerIndex): ClubTableView {
  const seatViews = buildTableSeatViews(state);
  const handView = buildHumanHandView(state, viewerSeat);
  const legal = legalActionsForPlayer(state, viewerSeat);
  const sittingOutPartner = state.lonePlayer === undefined ? undefined : partnerOf(state.lonePlayer);
  const status = buildTableStatusView(state);
  const currentTrick = buildCurrentTrickView(state);

  return {
    viewerSeat,
    phase: state.phase,
    dealer: state.dealer,
    activePlayer: state.activePlayer,
    maker: state.maker,
    makerPartnership: state.makerTeam,
    trump: state.trump,
    lonePlayer: state.lonePlayer,
    sittingOutPartner,
    scores: [...state.scores],
    status: {
      ...status,
      scores: [...status.scores]
    },
    scoreCards: buildEuchreScoreCardViews(state.scores),
    seats: seatViews.map((seat) => ({
      seat: seat.seat,
      position: positionRelativeToViewer(seat.seat, viewerSeat),
      displayName: seat.seat === viewerSeat ? "You" : seat.name,
      partnership: seat.team,
      cardCount: seat.cardCount,
      isViewer: seat.seat === viewerSeat,
      isDealer: seat.isDealer,
      isActive: seat.isActive,
      isMakerPartnership: seat.isMaker,
      isCaller: seat.isCaller,
      isPartnerOfCaller: seat.isPartnerOfCaller,
      isSittingOut: seat.seat === sittingOutPartner,
      recentAction: seat.recentAction
    })),
    viewerHand: {
      cards: handView.cards.map(cloneTableCard),
      actionLabel: handView.actionLabel,
      helperText: handView.helperText,
      detailText: handView.detailText
    },
    legal: {
      canClaimFarmersHand: legal.canClaimFarmersHand,
      canDeclineFarmersHand: legal.canDeclineFarmersHand,
      canPass: legal.canPass,
      canOrderUp: legal.canOrderUp,
      callableSuits: [...legal.callableSuits],
      playableCardIds: legal.playableCards.map(cardId),
      selectableCardIds: handView.cards.filter((card) => card.legal).map((card) => card.id),
      farmersHandReplaceableCardIds: legal.farmersHandReplaceableCards.map(cardId),
      mustDiscard: legal.mustDiscard
    },
    bids: state.bids.map((bid) => ({ ...bid })),
    currentTrick: cloneCurrentTrick(currentTrick)
  };
}

function positionRelativeToViewer(seat: PlayerIndex, viewerSeat: PlayerIndex): ClubTablePosition {
  const positions: ClubTablePosition[] = ["south", "west", "north", "east"];
  return positions[(seat - viewerSeat + 4) % 4];
}

function cloneTableCard(card: TableCardView): TableCardView {
  return {
    ...card,
    card: cloneCard(card.card)
  };
}

function cloneCurrentTrick(trick: CurrentTrickView): CurrentTrickView {
  return {
    ...trick,
    plays: trick.plays.map((play) => ({
      ...play,
      card: cloneCard(play.card)
    })),
    unplayedSeats: [...trick.unplayedSeats]
  };
}

function cloneCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
