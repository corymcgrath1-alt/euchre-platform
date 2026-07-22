import {
  buildBiddingTimeline,
  buildCurrentTrickView,
  buildEuchreScoreCardViews,
  buildFiveCardScoreView,
  buildHandResultExplanation,
  buildHumanHandView,
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
  TABLE_PLAYER_NAMES,
  type AvailableGameControls,
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
  type TeamIndex,
  type TurnPrompt
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

export interface ClubTablePublicKittyView {
  readonly hiddenCardCount: number;
  readonly upcard?: Card;
}

export interface ClubTableSummaryView {
  readonly handNumber: number;
  readonly scoreLabel: string;
  readonly targetScore: number;
  readonly phaseLabel: string;
  readonly dealerLabel: string;
  readonly activePlayerLabel: string;
  readonly botDifficultyLabel: string;
  readonly farmersHandModeLabel: string;
  readonly upcardLabel: string;
  readonly trumpLabel: string;
  readonly makersLabel: string;
  readonly trickScoreLabel: string;
  readonly handResultText?: string;
  readonly handPoints?: readonly [number, number];
  readonly winnerTeam?: TeamIndex;
  readonly passedOut: boolean;
  readonly rules: RuleSummary;
}

export interface ClubTableMoveView {
  readonly sequence: number;
  readonly player?: PlayerIndex;
  readonly label: string;
}

export interface BuildClubTableViewOptions {
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
  readonly farmersHandMode: FarmersHandMode;
  readonly scores: readonly [number, number];
  readonly tricksWon: readonly [number, number];
  readonly upcard?: Card;
  readonly kittyCardCount: number;
  readonly config: ClubTableConfigView;
  readonly status: ReturnType<typeof buildTableStatusView>;
  readonly summary: ClubTableSummaryView;
  readonly turnPrompt: TurnPrompt;
  readonly turn: TurnPrompt;
  readonly rules: RuleSummary;
  readonly gameControls: AvailableGameControls;
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
    readonly mustDiscard: boolean;
  };
  readonly legal: ClubTableLegalView;
  readonly bids: readonly BidDecision[];
  readonly bidding: BiddingTimelineView;
  readonly biddingTimeline: BiddingTimelineView;
  readonly currentTrick: CurrentTrickView;
  readonly publicKitty: ClubTablePublicKittyView;
  readonly handResult?: ClubTableHandResultView;
  readonly activity: readonly ClubTableActivityView[];
  readonly recentBotActions: readonly string[];
  readonly moveHistory: readonly ClubTableMoveView[];
}

export function buildClubTableView(
  state: GameState,
  viewerSeat: PlayerIndex,
  options: BuildClubTableViewOptions = {}
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
  const turn = buildTurnPrompt(state, viewerSeat);
  const rules = viewerSafeRuleSummary(buildRuleSummary(state.config, {
    events: state.moveLog.map((move) => ({ eventType: move.action.type, payload: move.action })),
    initialDealer: state.handNumber <= 1 ? state.dealer : undefined
  }));
  const activity = state.moveLog.map((move) => ({
    sequence: move.sequence,
    actorSeat: move.player,
    isBot: move.player !== undefined && move.player !== viewerSeat,
    label: safeMoveLabel(move.action)
  }));

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
    farmersHandMode: state.config.farmersHandMode,
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
    summary: {
      handNumber: state.handNumber,
      scoreLabel: status.scoreLabel,
      targetScore: state.config.targetScore,
      phaseLabel: status.phaseLabel,
      dealerLabel: status.dealerLabel,
      activePlayerLabel: status.activePlayerLabel,
      botDifficultyLabel: formatBotDifficulty(state.config.botDifficulty),
      farmersHandModeLabel: formatFarmersHandMode(state.config.farmersHandMode),
      upcardLabel: status.upcardLabel,
      trumpLabel: status.trumpLabel,
      makersLabel: status.makersLabel,
      trickScoreLabel: status.trickScoreLabel,
      handResultText: state.handResult || state.phase === "handComplete"
        ? buildHandResultExplanation(state)
        : undefined,
      handPoints: state.handResult ? [...state.handResult.pointsAwarded] : undefined,
      winnerTeam: gameWinner(state),
      passedOut: state.phase === "handComplete" && !state.handResult,
      rules: cloneRuleSummary(rules)
    },
    turnPrompt: { ...turn },
    turn: { ...turn },
    rules: cloneRuleSummary(rules),
    gameControls: { ...getAvailableGameControls(state) },
    scoreCards: cloneScoreCards(buildEuchreScoreCardViews(state.scores)),
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
      recentAction: safeRecentAction(state, seat.seat)
    })),
    viewerHand: {
      cards: handView.cards.map(cloneTableCard),
      actionLabel: handView.actionLabel,
      helperText: handView.helperText,
      detailText: handView.detailText,
      mustDiscard: handView.mustDiscard
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
    biddingTimeline: cloneBiddingTimeline(bidding),
    currentTrick: cloneCurrentTrick(currentTrick),
    publicKitty: {
      hiddenCardCount: Math.max(0, state.kitty.length - (state.upcard ? 1 : 0)),
      upcard: state.upcard ? cloneCard(state.upcard) : undefined
    },
    handResult: state.handResult ? cloneHandResult(state.handResult, state) : undefined,
    activity,
    recentBotActions: activity.filter((item) => item.isBot).slice(-5).map((item) => item.label),
    moveHistory: activity.map((item) => ({
      sequence: item.sequence,
      player: item.actorSeat,
      label: item.label
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

function viewerSafeRuleSummary(summary: RuleSummary): RuleSummary {
  return {
    ...summary,
    config: { ...summary.config },
    seed: undefined,
    seedLabel: "Not exposed",
    items: summary.items.filter((item) => item.label !== "Seed").map((item) => ({ ...item })),
    warnings: [...summary.warnings]
  };
}

function cloneRuleSummary(summary: RuleSummary): RuleSummary {
  return {
    ...summary,
    config: { ...summary.config },
    items: summary.items.map((item) => ({ ...item })),
    warnings: [...summary.warnings]
  };
}

function cloneScoreCards(cards: ReturnType<typeof buildEuchreScoreCardViews>): ReturnType<typeof buildEuchreScoreCardViews> {
  return cards.map((team) => ({
    ...team,
    cards: team.cards.map((card) => ({ ...card })) as typeof team.cards
  })) as ReturnType<typeof buildEuchreScoreCardViews>;
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

function safeRecentAction(state: GameState, seat: PlayerIndex): string | undefined {
  const move = [...state.moveLog].reverse().find((candidate) => candidate.player === seat);
  return move ? safeMoveLabel(move.action) : undefined;
}

function safeMoveLabel(action: GameState["moveLog"][number]["action"]): string {
  const actor = "player" in action ? TABLE_PLAYER_NAMES[action.player] : "Table";

  switch (action.type) {
    case "START_HAND":
      return "Started a new hand";
    case "NEXT_HAND":
      return "Dealt the next hand";
    case "FARMERS_HAND_DECLINE":
      return `${actor} declined Farmer's Hand`;
    case "FARMERS_HAND_REDEAL":
      return `${actor} claimed a Farmer's Hand redeal`;
    case "FARMERS_HAND_REPLACE":
      return `${actor} replaced ${action.cards.length} Farmer's Hand card${action.cards.length === 1 ? "" : "s"}`;
    case "PASS":
      return `${actor} passed`;
    case "ORDER_UP":
      return `${actor} ordered up${action.alone ? " alone" : ""}`;
    case "CALL_TRUMP":
      return `${actor} called ${action.suit}${action.alone ? " alone" : ""}`;
    case "DISCARD":
      return `${actor} discarded after pickup`;
    case "PLAY_CARD":
      return `${actor} played ${cardLabel(action.card)}`;
    case "RESET_GAME":
      return "Reset the local table";
  }
}

function gameWinner(state: GameState): TeamIndex | undefined {
  if (state.phase !== "gameComplete") return undefined;
  return state.scores[0] >= state.config.targetScore ? 0 : 1;
}

function cloneCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
