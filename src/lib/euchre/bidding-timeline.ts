import { cardLabel } from "./cards";
import { nextPlayer, partnerOf, teamOf } from "./deck";
import { TABLE_PLAYER_NAMES } from "./table-view";
import type { BidDecision, Card, GameAction, GameState, MoveEvent, PlayerIndex, Suit, TeamIndex } from "./types";

export type BiddingDecisionLabel =
  | "none"
  | "pass"
  | "ordered-up"
  | "assist"
  | "picked-up"
  | "turned-down"
  | "called";

export interface SeatBiddingDecision {
  seat: PlayerIndex;
  playerLabel: string;
  round?: 1 | 2;
  label: BiddingDecisionLabel;
  suit?: Suit;
  alone: boolean;
  text: string;
}

export interface BiddingTimelineView {
  dealer: PlayerIndex;
  dealerLabel: string;
  upcard?: Card;
  upcardLabel: string;
  currentRound: 1 | 2 | "complete";
  decisions: SeatBiddingDecision[];
  orderedBy?: PlayerIndex;
  pickedUpByDealer: boolean;
  turnedDownByDealer: boolean;
  calledBy?: PlayerIndex;
  calledSuit?: Suit;
  makerTeam?: TeamIndex;
  aloneSeat?: PlayerIndex;
  finalTrumpSuit?: Suit;
  summaryText: string;
  persistentLog: string[];
}

export function buildBiddingTimeline(state: GameState): BiddingTimelineView {
  const orderedBid = state.bids.find((bid) => bid.round === 1 && bid.decision === "order-up");
  const calledBid = state.bids.find((bid) => bid.round === 2 && bid.decision === "call");
  const roundOnePasses = state.bids.filter((bid) => bid.round === 1 && bid.decision === "pass");
  const turnedDownByDealer = !orderedBid && roundOnePasses.length >= 4;
  const currentRound = state.phase === "calling" || calledBid ? 2 : state.phase === "playing" || state.phase === "discarding" || state.phase === "handComplete" || state.phase === "gameComplete" ? "complete" : 1;
  const aloneSeat = orderedBid?.alone ? orderedBid.player : calledBid?.alone ? calledBid.player : state.lonePlayer;
  const finalTrumpSuit = state.trump ?? orderedBid?.suit ?? calledBid?.suit;
  const pickedUpByDealer = Boolean(orderedBid && orderedBid.player === state.dealer);
  const decisions = buildSeatDecisions(state, orderedBid, calledBid, turnedDownByDealer);
  const persistentLog = buildPersistentLog(state, orderedBid, calledBid, turnedDownByDealer);

  return {
    dealer: state.dealer,
    dealerLabel: TABLE_PLAYER_NAMES[state.dealer],
    upcard: state.upcard,
    upcardLabel: state.upcard ? cardLabel(state.upcard) : "No upcard",
    currentRound,
    decisions,
    orderedBy: orderedBid?.player,
    pickedUpByDealer,
    turnedDownByDealer,
    calledBy: calledBid?.player,
    calledSuit: calledBid?.suit,
    makerTeam: state.makerTeam,
    aloneSeat,
    finalTrumpSuit,
    summaryText: buildSummaryText(state, orderedBid, calledBid, turnedDownByDealer),
    persistentLog
  };
}

function buildSeatDecisions(
  state: GameState,
  orderedBid: BidDecision | undefined,
  calledBid: BidDecision | undefined,
  turnedDownByDealer: boolean
): SeatBiddingDecision[] {
  return ([0, 1, 2, 3] as PlayerIndex[]).map((seat) => {
    const latest = [...state.bids].reverse().find((bid) => bid.player === seat);
    if (orderedBid?.player === seat) {
      const label = seat === state.dealer ? "picked-up" : partnerOf(seat) === state.dealer ? "assist" : "ordered-up";
      return decision(seat, orderedBid.round, label, orderedBid.suit, Boolean(orderedBid.alone), orderText(state, orderedBid));
    }

    if (calledBid?.player === seat) {
      return decision(seat, calledBid.round, "called", calledBid.suit, Boolean(calledBid.alone), `${TABLE_PLAYER_NAMES[seat]} called ${calledBid.suit}${calledBid.alone ? " alone" : ""}`);
    }

    if (turnedDownByDealer && seat === state.dealer) {
      return decision(seat, 1, "turned-down", state.upcard?.suit, false, `${TABLE_PLAYER_NAMES[seat]} turned down ${state.upcard ? cardLabel(state.upcard) : "the upcard"}`);
    }

    if (latest?.decision === "pass") {
      return decision(seat, latest.round, "pass", latest.suit, false, `${TABLE_PLAYER_NAMES[seat]} passed`);
    }

    return decision(seat, undefined, "none", undefined, false, `${TABLE_PLAYER_NAMES[seat]} waiting`);
  });
}

function decision(
  seat: PlayerIndex,
  round: 1 | 2 | undefined,
  label: BiddingDecisionLabel,
  suit: Suit | undefined,
  alone: boolean,
  text: string
): SeatBiddingDecision {
  return {
    seat,
    playerLabel: TABLE_PLAYER_NAMES[seat],
    round,
    label,
    suit,
    alone,
    text
  };
}

function buildSummaryText(
  state: GameState,
  orderedBid: BidDecision | undefined,
  calledBid: BidDecision | undefined,
  turnedDownByDealer: boolean
): string {
  if (orderedBid) {
    const upcard = state.upcard ? cardLabel(state.upcard) : "the upcard";
    if (orderedBid.player === state.dealer) {
      return `Trump: ${orderedBid.suit} - ${TABLE_PLAYER_NAMES[state.dealer]} picked up ${upcard}${orderedBid.alone ? " alone" : ""}.`;
    }

    const assist = partnerOf(orderedBid.player) === state.dealer ? " assisted and ordered partner to pick up" : " ordered";
    return `Trump: ${orderedBid.suit} - ${TABLE_PLAYER_NAMES[orderedBid.player]}${assist} ${TABLE_PLAYER_NAMES[state.dealer]} to pick up ${upcard}${orderedBid.alone ? " alone" : ""}.`;
  }

  if (calledBid) {
    const forced = state.config.stickDealer && calledBid.player === state.dealer && state.bids.filter((bid) => bid.round === 2 && bid.decision === "pass").length >= 3;
    return forced
      ? `Stick the Dealer: ${TABLE_PLAYER_NAMES[calledBid.player]} forced to choose ${calledBid.suit}.`
      : `Trump: ${calledBid.suit} - ${TABLE_PLAYER_NAMES[calledBid.player]} called ${calledBid.suit} in Round 2${calledBid.alone ? " alone" : ""}.`;
  }

  if (turnedDownByDealer) {
    return `Upcard ${state.upcard ? cardLabel(state.upcard) : ""} turned down by dealer ${TABLE_PLAYER_NAMES[state.dealer]}.`;
  }

  const actor = state.phase === "ordering" || state.phase === "calling" ? TABLE_PLAYER_NAMES[state.activePlayer] : TABLE_PLAYER_NAMES[nextPlayer(state.dealer)];
  return state.phase === "calling"
    ? `Round 2: ${actor} may call a suit other than ${state.turnedDownSuit ?? "the upcard suit"}.`
    : `Round 1: ${actor} may order ${TABLE_PLAYER_NAMES[state.dealer]} to pick up ${state.upcard ? cardLabel(state.upcard) : "the upcard"}.`;
}

function buildPersistentLog(
  state: GameState,
  orderedBid: BidDecision | undefined,
  calledBid: BidDecision | undefined,
  turnedDownByDealer: boolean
): string[] {
  const fromEvents = state.moveLog
    .map((event) => eventLogLine(event, state.dealer, state.upcard))
    .filter((line): line is string => Boolean(line));

  if (fromEvents.length) {
    return fromEvents.slice(-8);
  }

  const lines = state.bids.map((bid) => bidLogLine(bid, state.dealer, state.upcard));
  if (turnedDownByDealer) {
    lines.push(`${TABLE_PLAYER_NAMES[state.dealer]} turned down ${state.upcard ? cardLabel(state.upcard) : "the upcard"}`);
  }
  if (orderedBid && !lines.some((line) => line.includes("ordered") || line.includes("picked up"))) {
    lines.push(orderText(state, orderedBid));
  }
  if (calledBid && !lines.some((line) => line.includes("called"))) {
    lines.push(`${TABLE_PLAYER_NAMES[calledBid.player]} called ${calledBid.suit}`);
  }
  return lines.slice(-8);
}

function eventLogLine(event: MoveEvent, dealer: PlayerIndex, upcard?: Card): string | undefined {
  return actionLogLine(event.action, dealer, upcard);
}

function actionLogLine(action: GameAction, dealer: PlayerIndex, upcard?: Card): string | undefined {
  switch (action.type) {
    case "PASS":
      return `${TABLE_PLAYER_NAMES[action.player]} passed`;
    case "ORDER_UP":
      return action.player === dealer
        ? `${TABLE_PLAYER_NAMES[action.player]} picked up ${upcard ? cardLabel(upcard) : "the upcard"}${action.alone ? " alone" : ""}`
        : `${TABLE_PLAYER_NAMES[action.player]} ordered ${TABLE_PLAYER_NAMES[dealer]} up${action.alone ? " alone" : ""}`;
    case "CALL_TRUMP":
      return `${TABLE_PLAYER_NAMES[action.player]} called ${action.suit}${action.alone ? " alone" : ""}`;
    case "DISCARD":
      return `${TABLE_PLAYER_NAMES[action.player]} discarded after pickup`;
    default:
      return undefined;
  }
}

function bidLogLine(bid: BidDecision, dealer: PlayerIndex, upcard?: Card): string {
  if (bid.decision === "pass") {
    return `${TABLE_PLAYER_NAMES[bid.player]} passed`;
  }

  if (bid.decision === "order-up") {
    return bid.player === dealer
      ? `${TABLE_PLAYER_NAMES[bid.player]} picked up ${upcard ? cardLabel(upcard) : "the upcard"}${bid.alone ? " alone" : ""}`
      : `${TABLE_PLAYER_NAMES[bid.player]} ordered ${TABLE_PLAYER_NAMES[dealer]} up${bid.alone ? " alone" : ""}`;
  }

  return `${TABLE_PLAYER_NAMES[bid.player]} called ${bid.suit}${bid.alone ? " alone" : ""}`;
}

function orderText(state: GameState, bid: BidDecision): string {
  if (bid.player === state.dealer) {
    return `${TABLE_PLAYER_NAMES[bid.player]} picked up ${state.upcard ? cardLabel(state.upcard) : "the upcard"}${bid.alone ? " alone" : ""}`;
  }

  const assist = partnerOf(bid.player) === state.dealer ? "assisted and ordered partner up" : `ordered ${TABLE_PLAYER_NAMES[state.dealer]} up`;
  const makerTeam = teamOf(bid.player);
  return `${TABLE_PLAYER_NAMES[bid.player]} ${assist}${bid.alone ? " alone" : ""} for Team ${makerTeam}`;
}
