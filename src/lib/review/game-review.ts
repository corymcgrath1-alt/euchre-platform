import {
  applyMoveEvent,
  effectiveSuit,
  createInitialGameState,
  isTrump,
  buildRuleSummary,
  teamOf,
  type BidDecision,
  type Card,
  type GameConfig,
  type GameState,
  type HandResult,
  type PlayerIndex,
  type RuleSummary,
  type Suit,
  type TeamIndex,
  type Trick
} from "@/lib/euchre";
import { persistedEventToMoveEvent } from "@/lib/persistence/replay";
import type { PersistedMoveEventRecord } from "@/lib/persistence/types";

const SEATS = [0, 1, 2, 3] as const;
const TEAMS = [0, 1] as const;

export interface TeamReviewStats {
  team: TeamIndex;
  pointsScored: number;
  handsWon: number;
  makerHands: number;
  successfulMakerHands: number;
  failedMakerHands: number;
  defenderEuchres: number;
  tricksWon: number;
  loneAttempts: number;
  successfulLoners: number;
}

export interface SeatReviewStats {
  seat: PlayerIndex;
  team: TeamIndex;
  handsDealt: number;
  timesDealer: number;
  timesCaller: number;
  successfulCalls: number;
  failedCalls: number;
  loneAttempts: number;
  successfulLoners: number;
  tricksWon: number;
  cardsPlayed: number;
  firstTricksWon: number;
  finalTricksWon: number;
}

export interface BiddingActionReview {
  sequenceNumber: number;
  round: 1 | 2;
  player: PlayerIndex;
  decision: BidDecision["decision"];
  suit?: Suit;
  alone: boolean;
}

export interface CardPlayReview {
  sequenceNumber: number;
  order: number;
  player: PlayerIndex;
  team: TeamIndex;
  card: Card;
  effectiveSuit: Suit;
  playedTrump: boolean;
}

export interface TrickReview {
  handNumber: number;
  trickNumber: number;
  leader: PlayerIndex;
  cardsPlayed: CardPlayReview[];
  winningSeat: PlayerIndex;
  winningTeam: TeamIndex;
  ledSuit: Suit;
  trumpSuit?: Suit;
  trumpPlayed: boolean;
  winnerUsedTrump: boolean;
  winnerRelationToCaller: "caller" | "partner" | "opponent" | "unknown";
}

export interface HandReview {
  handNumber: number;
  dealer: PlayerIndex;
  upcard?: Card;
  trumpSuit?: Suit;
  maker?: PlayerIndex;
  makerTeam?: TeamIndex;
  defendingTeam?: TeamIndex;
  aloneDeclared: boolean;
  dealerPickup?: {
    orderedBy: PlayerIndex;
    dealer: PlayerIndex;
    upcard: Card;
  };
  dealerDiscard?: {
    dealer: PlayerIndex;
    card: Card;
  };
  roundOneBids: BiddingActionReview[];
  roundTwoBids: BiddingActionReview[];
  tricks: TrickReview[];
  makerTricks: number;
  defenderTricks: number;
  scoringResult: "makers-point" | "makers-march" | "lone-march" | "euchre" | "passed";
  pointsAwarded: [number, number];
  teamScoreAfterHand: [number, number];
  tricksWon: [number, number];
  makersSucceeded: boolean;
  defendersEuchredMakers: boolean;
  euchred: boolean;
  lone: boolean;
  loneSucceeded: boolean;
  passed: boolean;
}

export type CompletedHandReview = HandReview;

export interface GameReview {
  gameId: string;
  winningTeam: TeamIndex;
  finalScore: [number, number];
  totalHandsPlayed: number;
  totalEvents: number;
  totalTricksPlayed: number;
  totalEuchres: number;
  totalSuccessfulMakerHands: number;
  totalFailedMakerHands: number;
  totalLoneAttempts: number;
  totalSuccessfulLoneHands: number;
  totalDealerPickups: number;
  totalPassedHands: number;
  longestScoringStreakByTeam: [number, number];
  teams: [TeamReviewStats, TeamReviewStats];
  seats: [SeatReviewStats, SeatReviewStats, SeatReviewStats, SeatReviewStats];
  hands: HandReview[];
  ruleSummary: RuleSummary;
}

export type GameReviewSummary = GameReview;

export class GameReviewUnavailableError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "GameReviewUnavailableError";
  }
}

export function buildGameReview({
  gameId,
  config,
  events
}: {
  gameId: string;
  config: GameConfig;
  events: PersistedMoveEventRecord[];
}): GameReviewSummary {
  const orderedEvents = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  if (orderedEvents.length === 0) {
    throw new GameReviewUnavailableError("Cannot generate review without move events", 422);
  }

  let state: GameState = { ...createInitialGameState(config), id: gameId };
  const teams = makeTeamStats();
  const seats = makeSeatStats();
  const hands: HandReview[] = [];
  let currentHand: HandReview | null = null;
  let totalDealerPickups = 0;
  let currentScoringTeam: TeamIndex | null = null;
  let currentScoringStreak = 0;
  const longestScoringStreakByTeam: [number, number] = [0, 0];

  for (const event of orderedEvents) {
    const move = persistedEventToMoveEvent(event);
    const before = state;
    state = applyMoveEvent(state, move);

    if (event.eventType === "START_HAND" || event.eventType === "NEXT_HAND") {
      seats[state.dealer].handsDealt += 1;
      seats[state.dealer].timesDealer += 1;
      currentHand = createHandReviewFromDeal(state);
    }

    if (event.eventType === "FARMERS_HAND_REDEAL") {
      currentHand = createHandReviewFromDeal(state);
    }

    if (currentHand && (event.eventType === "PASS" || event.eventType === "ORDER_UP" || event.eventType === "CALL_TRUMP")) {
      addBiddingAction(currentHand, event, before);
    }

    if (currentHand && event.eventType === "ORDER_UP" && event.player !== undefined && before.upcard) {
      totalDealerPickups += 1;
      currentHand.dealerPickup = {
        orderedBy: event.player,
        dealer: before.dealer,
        upcard: before.upcard
      };
    }

    if (event.eventType === "PLAY_CARD" && event.player !== undefined) {
      seats[event.player].cardsPlayed += 1;
    }

    if (currentHand && event.eventType === "DISCARD" && event.player !== undefined && event.payload.type === "DISCARD") {
      currentHand.dealerDiscard = {
        dealer: event.player,
        card: event.payload.card
      };
    }

    if (currentHand && event.eventType === "PLAY_CARD" && before.completedTricks.length < state.completedTricks.length) {
      const trick = state.completedTricks[state.completedTricks.length - 1];
      if (trick) {
        currentHand.tricks.push(summarizeTrick(state, trick, currentHand.tricks.length + 1));
      }
    }

    if (isNewlyCompletedHand(before, state)) {
      const completedHand = summarizeCompletedHand(state, currentHand);
      hands.push(completedHand);
      applyHandStats(completedHand, state.completedTricks, teams, seats);

      const scoringTeam = scoringTeamFor(completedHand.pointsAwarded);
      if (scoringTeam === null) {
        currentScoringTeam = null;
        currentScoringStreak = 0;
      } else {
        currentScoringStreak = currentScoringTeam === scoringTeam ? currentScoringStreak + 1 : 1;
        currentScoringTeam = scoringTeam;
        longestScoringStreakByTeam[scoringTeam] = Math.max(
          longestScoringStreakByTeam[scoringTeam],
          currentScoringStreak
        );
      }
      currentHand = null;
    }
  }

  if (state.phase !== "gameComplete") {
    throw new GameReviewUnavailableError("Game review is available after game completion");
  }

  const winningTeam = state.scores[0] >= config.targetScore ? 0 : 1;

  return {
    gameId,
    winningTeam,
    finalScore: [...state.scores],
    totalHandsPlayed: hands.length,
    totalEvents: orderedEvents.length,
    totalTricksPlayed: hands.reduce((total, hand) => total + hand.tricks.length, 0),
    totalEuchres: hands.filter((hand) => hand.euchred).length,
    totalSuccessfulMakerHands: hands.filter((hand) => !hand.passed && !hand.euchred).length,
    totalFailedMakerHands: hands.filter((hand) => hand.euchred).length,
    totalLoneAttempts: hands.filter((hand) => hand.lone).length,
    totalSuccessfulLoneHands: hands.filter((hand) => hand.loneSucceeded).length,
    totalDealerPickups,
    totalPassedHands: hands.filter((hand) => hand.passed).length,
    longestScoringStreakByTeam,
    teams,
    seats,
    hands,
    ruleSummary: buildRuleSummary(config, { events: orderedEvents, initialDealer: hands[0]?.dealer })
  };
}

function makeTeamStats(): [TeamReviewStats, TeamReviewStats] {
  return TEAMS.map((team) => ({
    team,
    pointsScored: 0,
    handsWon: 0,
    makerHands: 0,
    successfulMakerHands: 0,
    failedMakerHands: 0,
    defenderEuchres: 0,
    tricksWon: 0,
    loneAttempts: 0,
    successfulLoners: 0
  })) as [TeamReviewStats, TeamReviewStats];
}

function makeSeatStats(): [SeatReviewStats, SeatReviewStats, SeatReviewStats, SeatReviewStats] {
  return SEATS.map((seat) => ({
    seat,
    team: teamOf(seat),
    handsDealt: 0,
    timesDealer: 0,
    timesCaller: 0,
    successfulCalls: 0,
    failedCalls: 0,
    loneAttempts: 0,
    successfulLoners: 0,
    tricksWon: 0,
    cardsPlayed: 0,
    firstTricksWon: 0,
    finalTricksWon: 0
  })) as [SeatReviewStats, SeatReviewStats, SeatReviewStats, SeatReviewStats];
}

function isNewlyCompletedHand(before: GameState, after: GameState): boolean {
  return (
    before.phase !== "handComplete" &&
    before.phase !== "gameComplete" &&
    (after.phase === "handComplete" || after.phase === "gameComplete")
  );
}

function createHandReviewFromDeal(state: GameState): HandReview {
  return {
    handNumber: state.handNumber,
    dealer: state.dealer,
    upcard: state.upcard,
    aloneDeclared: false,
    roundOneBids: [],
    roundTwoBids: [],
    tricks: [],
    makerTricks: 0,
    defenderTricks: 0,
    scoringResult: "passed",
    pointsAwarded: [0, 0],
    teamScoreAfterHand: [...state.scores],
    tricksWon: [0, 0],
    makersSucceeded: false,
    defendersEuchredMakers: false,
    euchred: false,
    lone: false,
    loneSucceeded: false,
    passed: false
  };
}

function addBiddingAction(hand: HandReview, event: PersistedMoveEventRecord, before: GameState): void {
  const action = event.payload;
  if (!("player" in action)) {
    return;
  }

  const round = before.phase === "ordering" ? 1 : 2;
  const bid: BiddingActionReview = {
    sequenceNumber: event.sequenceNumber,
    round,
    player: action.player,
    decision: biddingDecision(action.type),
    suit: biddingSuit(action.type, action, before),
    alone: "alone" in action ? Boolean(action.alone) : false
  };

  if (round === 1) {
    hand.roundOneBids.push(bid);
  } else {
    hand.roundTwoBids.push(bid);
  }
}

function biddingSuit(
  actionType: PersistedMoveEventRecord["eventType"],
  action: PersistedMoveEventRecord["payload"],
  before: GameState
): Suit | undefined {
  if (actionType === "ORDER_UP") {
    return before.upcard?.suit;
  }

  if (action.type === "CALL_TRUMP") {
    return action.suit;
  }

  return undefined;
}

function biddingDecision(actionType: PersistedMoveEventRecord["eventType"]): BidDecision["decision"] {
  if (actionType === "ORDER_UP") {
    return "order-up";
  }

  if (actionType === "CALL_TRUMP") {
    return "call";
  }

  return "pass";
}

function summarizeCompletedHand(state: GameState, hand: HandReview | null): HandReview {
  const base = hand ?? createHandReviewFromDeal(state);

  if (!state.handResult) {
    return {
      ...base,
      handNumber: state.handNumber,
      dealer: state.dealer,
      pointsAwarded: [0, 0],
      teamScoreAfterHand: [...state.scores],
      tricksWon: [0, 0],
      makerTricks: 0,
      defenderTricks: 0,
      scoringResult: "passed",
      makersSucceeded: false,
      defendersEuchredMakers: false,
      euchred: false,
      lone: false,
      loneSucceeded: false,
      passed: true
    };
  }

  const makerTeam = state.handResult.makers;
  const defenderTeam = makerTeam === 0 ? 1 : 0;
  const makerTricks = state.handResult.tricksWon[makerTeam];
  const defenderTricks = state.handResult.tricksWon[defenderTeam];

  return {
    ...base,
    handNumber: state.handNumber,
    dealer: state.dealer,
    upcard: base.upcard ?? state.upcard,
    trumpSuit: state.handResult.trump,
    maker: state.handResult.maker,
    makerTeam,
    defendingTeam: defenderTeam,
    aloneDeclared: state.handResult.lone,
    makerTricks,
    defenderTricks,
    scoringResult: scoringResultFor(state.handResult),
    pointsAwarded: [...state.handResult.pointsAwarded],
    teamScoreAfterHand: [...state.scores],
    tricksWon: [...state.handResult.tricksWon],
    makersSucceeded: !state.handResult.euchred,
    defendersEuchredMakers: state.handResult.euchred,
    euchred: state.handResult.euchred,
    lone: state.handResult.lone,
    loneSucceeded: isSuccessfulLoner(state.handResult),
    passed: false
  };
}

function summarizeTrick(state: GameState, trick: Trick, trickNumber: number): TrickReview {
  if (trick.winner === undefined) {
    throw new Error("Cannot review a trick without a winner");
  }

  const trump = state.trump;
  const ledSuit = effectiveSuit(trick.plays[0].card, trump);
  const cardsPlayed = trick.plays.map((play, index) => ({
    sequenceNumber: findPlaySequence(state, play.player, play.card),
    order: index + 1,
    player: play.player,
    team: teamOf(play.player),
    card: play.card,
    effectiveSuit: effectiveSuit(play.card, trump),
    playedTrump: trump ? isTrump(play.card, trump) : false
  }));
  const winningPlay = cardsPlayed.find((play) => play.player === trick.winner);

  return {
    handNumber: state.handNumber,
    trickNumber,
    leader: trick.leader,
    cardsPlayed,
    winningSeat: trick.winner,
    winningTeam: teamOf(trick.winner),
    ledSuit,
    trumpSuit: trump,
    trumpPlayed: cardsPlayed.some((play) => play.playedTrump),
    winnerUsedTrump: Boolean(winningPlay?.playedTrump),
    winnerRelationToCaller: relationToCaller(trick.winner, state.maker)
  };
}

function findPlaySequence(state: GameState, player: PlayerIndex, card: Card): number {
  const found = [...state.moveLog].reverse().find((event) => (
    event.action.type === "PLAY_CARD" &&
    event.action.player === player &&
    event.action.card.rank === card.rank &&
    event.action.card.suit === card.suit
  ));

  return found?.sequence ?? -1;
}

function relationToCaller(winner: PlayerIndex, maker: PlayerIndex | undefined): TrickReview["winnerRelationToCaller"] {
  if (maker === undefined) {
    return "unknown";
  }

  if (winner === maker) {
    return "caller";
  }

  return teamOf(winner) === teamOf(maker) ? "partner" : "opponent";
}

function scoringResultFor(handResult: HandResult): HandReview["scoringResult"] {
  if (handResult.euchred) {
    return "euchre";
  }

  if (handResult.lone && handResult.march) {
    return "lone-march";
  }

  if (handResult.march) {
    return "makers-march";
  }

  return "makers-point";
}

function applyHandStats(
  hand: CompletedHandReview,
  tricks: Trick[],
  teams: [TeamReviewStats, TeamReviewStats],
  seats: [SeatReviewStats, SeatReviewStats, SeatReviewStats, SeatReviewStats]
): void {
  for (const team of TEAMS) {
    teams[team].pointsScored += hand.pointsAwarded[team];
    teams[team].tricksWon += hand.tricksWon[team];
    if (hand.pointsAwarded[team] > 0) {
      teams[team].handsWon += 1;
    }
  }

  if (hand.maker !== undefined && hand.makerTeam !== undefined) {
    const makerTeam = hand.makerTeam;
    const defenderTeam = makerTeam === 0 ? 1 : 0;
    teams[makerTeam].makerHands += 1;
    seats[hand.maker].timesCaller += 1;

    if (hand.euchred) {
      teams[makerTeam].failedMakerHands += 1;
      teams[defenderTeam].defenderEuchres += 1;
      seats[hand.maker].failedCalls += 1;
    } else {
      teams[makerTeam].successfulMakerHands += 1;
      seats[hand.maker].successfulCalls += 1;
    }

    if (hand.lone) {
      teams[makerTeam].loneAttempts += 1;
      seats[hand.maker].loneAttempts += 1;
    }

    if (hand.loneSucceeded) {
      teams[makerTeam].successfulLoners += 1;
      seats[hand.maker].successfulLoners += 1;
    }
  }

  for (const trick of tricks) {
    if (trick.winner === undefined) {
      continue;
    }

    seats[trick.winner].tricksWon += 1;
  }

  const firstWinner = tricks[0]?.winner;
  if (firstWinner !== undefined) {
    seats[firstWinner].firstTricksWon += 1;
  }

  const finalWinner = tricks[tricks.length - 1]?.winner;
  if (finalWinner !== undefined) {
    seats[finalWinner].finalTricksWon += 1;
  }
}

function scoringTeamFor(pointsAwarded: [number, number]): TeamIndex | null {
  if (pointsAwarded[0] > 0) {
    return 0;
  }

  if (pointsAwarded[1] > 0) {
    return 1;
  }

  return null;
}

function isSuccessfulLoner(handResult: HandResult): boolean {
  return handResult.lone && handResult.march;
}
