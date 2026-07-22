import {
  buildBiddingTimeline,
  buildCurrentTrickView,
  buildEuchreScoreCardViews,
  buildFiveCardScoreView,
  buildHumanHandView,
  buildHandResultExplanation,
  buildRuleSummary,
  buildTableSeatViews,
  buildTableStatusView,
  buildTurnPrompt,
  cardId,
  cardLabel,
  formatBotDifficulty,
  formatFarmersHandMode,
  getAvailableGameControls,
  legalActionsForPlayer,
  partnerOf,
  type BidDecision,
  type BiddingTimelineView,
  type Card,
  type CurrentTrickView,
  type FarmersHandMode,
  type GameState,
  type HandResult,
  type Phase,
  type PlayerIndex,
  type RuleSummary,
  type Suit,
  type TableCardView,
  type TeamIndex
} from "@/lib/euchre";

export type ClubTablePosition = "south" | "west" | "north" | "east";

export interface ClubTableSeatView {
  readonly seat: PlayerIndex;
  readonly position: ClubTablePosition;
  readonly displayName: string;
  readonly partnership: TeamIndex;
  readonly cardCount: number;
  readonly isViewer: boolean;
  readonly isDealer: boolean;
  readonly isActive: boolean;
  readonly isMakerPartnership: boolean;
  readonly isCaller: boolean;
  readonly isPartnerOfCaller: boolean;
  readonly isSittingOut: boolean;
  readonly recentAction?: string;
}

export interface ClubTableLegalView {
  readonly canClaimFarmersHand: boolean;
  readonly canDeclineFarmersHand: boolean;
  readonly canPass: boolean;
  readonly canOrderUp: boolean;
  readonly callableSuits: readonly Suit[];
  readonly playableCardIds: readonly string[];
  readonly selectableCardIds: readonly string[];
  readonly farmersHandReplaceableCardIds: readonly string[];
  readonly mustDiscard: boolean;
}

export interface ClubTableActivityView {
  readonly sequence: number;
  readonly actorSeat?: PlayerIndex;
  readonly isBot: boolean;
  readonly label: string;
}

export interface ClubTableHandResultView {
  readonly makers: TeamIndex;
  readonly maker: PlayerIndex;
  readonly trump: Suit;
  readonly tricksWon: readonly [number, number];
  readonly pointsAwarded: readonly [number, number];
  readonly lone: boolean;
  readonly euchred: boolean;
  readonly march: boolean;
  readonly explanation: string;
}

export interface ClubTableConfigView {
  readonly targetScore: number;
  readonly botDifficultyLabel: string;
  readonly farmersHandMode: FarmersHandMode;
  readonly farmersHandModeLabel: string;
}

export interface ClubTableViewOptions {
  readonly showLatestCompletedTrick?: boolean;
}

export interface ClubTableView {
  readonly viewerSeat: PlayerIndex;
  readonly phase: Phase;
  readonly handNumber: number;
  readonly dealer: PlayerIndex;
  readonly activePlayer: PlayerIndex;
  readonly maker?: PlayerIndex;
  readonly makerPartnership?: TeamIndex;
  readonly trump?: Suit;
  readonly lonePlayer?: PlayerIndex;
  readonly sittingOutPartner?: PlayerIndex;
  readonly scores: readonly [number, number];
  readonly tricksWon: readonly [number, number];
  readonly upcard?: Card;
  readonly kittyCardCount: number;
  readonly config: ClubTableConfigView;
  readonly status: ReturnType<typeof buildTableStatusView>;
  readonly scoreCards: ReturnType<typeof buildEuchreScoreCardViews>;
  readonly fiveCardScores: readonly [
    ReturnType<typeof buildFiveCardScoreView>,
    ReturnType<typeof buildFiveCardScoreView>
  ];
  readonly seats: readonly ClubTableSeatView[];
  readonly viewerHand: {
    readonly cards: readonly TableCardView[];
    readonly actionLabel: string;
    readonly helperText: string;
    readonly detailText?: string;
  };
  readonly legal: ClubTableLegalView;
  readonly bids: readonly BidDecision[];
  readonly bidding: BiddingTimelineView;
  readonly currentTrick: CurrentTrickView;
  readonly turn: ReturnType<typeof buildTurnPrompt>;
  readonly rules: RuleSummary;
  readonly gameControls: ReturnType<typeof getAvailableGameControls>;
  readonly handResult?: ClubTableHandResultView;
  readonly activity: readonly ClubTableActivityView[];
}

export function buildClubTableView(
  state: GameState,
  viewerSeat: PlayerIndex,
  options: ClubTableViewOptions = {}
): ClubTableView {
  const seatViews = buildTableSeatViews(state);
  const handView = buildHumanHandView(state, viewerSeat);
  const legal = legalActionsForPlayer(state, viewerSeat);
  const sittingOutPartner = state.lonePlayer === undefined ? undefined : partnerOf(state.lonePlayer);
  const status = buildTableStatusView(state);
  const currentTrick = buildCurrentTrickView(state, {
    showLatestCompleted: options.showLatestCompletedTrick
  });
  const bidding = buildBiddingTimeline(state);

  return {
    viewerSeat,
    phase: state.phase,
    handNumber: state.handNumber,
    dealer: state.dealer,
    activePlayer: state.activePlayer,
    maker: state.maker,
    makerPartnership: state.makerTeam,
    trump: state.trump,
    lonePlayer: state.lonePlayer,
    sittingOutPartner,
    scores: [...state.scores],
    tricksWon: [...state.tricksWon],
    upcard: state.upcard ? cloneCard(state.upcard) : undefined,
    kittyCardCount: state.kitty.length,
    config: {
      targetScore: state.config.targetScore,
      botDifficultyLabel: formatBotDifficulty(state.config.botDifficulty),
      farmersHandMode: state.config.farmersHandMode,
      farmersHandModeLabel: formatFarmersHandMode(state.config.farmersHandMode)
    },
    status: {
      ...status,
      scores: [...status.scores]
    },
    scoreCards: buildEuchreScoreCardViews(state.scores),
    fiveCardScores: [
      buildFiveCardScoreView(state.scores[0], "red"),
      buildFiveCardScoreView(state.scores[1], "black")
    ],
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
    bidding: cloneBiddingTimeline(bidding),
    currentTrick: cloneCurrentTrick(currentTrick),
    turn: { ...buildTurnPrompt(state, viewerSeat) },
    rules: cloneRuleSummary(buildRuleSummary(state.config, {
      events: state.moveLog.map((move) => ({ eventType: move.action.type, payload: move.action })),
      initialDealer: state.handNumber <= 1 ? state.dealer : undefined
    })),
    gameControls: { ...getAvailableGameControls(state) },
    handResult: state.handResult ? cloneHandResult(state.handResult, state) : undefined,
    activity: state.moveLog.map((move) => ({
      sequence: move.sequence,
      actorSeat: move.player,
      isBot: move.player !== undefined && move.player !== viewerSeat,
      label: publicMoveLabel(move.action)
    }))
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

function cloneBiddingTimeline(timeline: BiddingTimelineView): BiddingTimelineView {
  return {
    ...timeline,
    upcard: timeline.upcard ? cloneCard(timeline.upcard) : undefined,
    decisions: timeline.decisions.map((decision) => ({ ...decision })),
    persistentLog: [...timeline.persistentLog]
  };
}

function cloneRuleSummary(summary: RuleSummary): RuleSummary {
  return {
    ...summary,
    seed: undefined,
    seedLabel: "Not exposed",
    items: summary.items.filter((item) => item.label !== "Seed").map((item) => ({ ...item })),
    warnings: [...summary.warnings]
  };
}

function cloneHandResult(result: HandResult, state: GameState): ClubTableHandResultView {
  return {
    makers: result.makers,
    maker: result.maker,
    trump: result.trump,
    tricksWon: [...result.tricksWon],
    pointsAwarded: [...result.pointsAwarded],
    lone: result.lone,
    euchred: result.euchred,
    march: result.march,
    explanation: buildHandResultExplanation(state)
  };
}

function publicMoveLabel(action: GameState["moveLog"][number]["action"]): string {
  switch (action.type) {
    case "START_HAND":
      return "Started a new hand";
    case "NEXT_HAND":
      return "Dealt the next hand";
    case "FARMERS_HAND_DECLINE":
      return `${playerLabel(action.player)} declined Farmer's Hand`;
    case "FARMERS_HAND_REDEAL":
      return `${playerLabel(action.player)} claimed a Farmer's Hand redeal`;
    case "FARMERS_HAND_REPLACE":
      return `${playerLabel(action.player)} replaced ${action.cards.length} Farmer's Hand card${action.cards.length === 1 ? "" : "s"}`;
    case "PASS":
      return `${playerLabel(action.player)} passed`;
    case "ORDER_UP":
      return `${playerLabel(action.player)} ordered up${action.alone ? " alone" : ""}`;
    case "CALL_TRUMP":
      return `${playerLabel(action.player)} called ${action.suit}${action.alone ? " alone" : ""}`;
    case "DISCARD":
      return `${playerLabel(action.player)} discarded after pickup`;
    case "PLAY_CARD":
      return `${playerLabel(action.player)} played ${cardLabel(action.card)}`;
    case "RESET_GAME":
      return "Reset the local table";
  }
}

function playerLabel(player: PlayerIndex): string {
  return ["South", "West", "North", "East"][player];
}

function cloneCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
