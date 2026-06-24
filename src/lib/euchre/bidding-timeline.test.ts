import { describe, expect, it } from "vitest";
import { createInitialGameState, dispatchAction } from "./engine";
import { buildBiddingTimeline } from "./bidding-timeline";
import type { Card, GameState } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("bidding timeline view model", () => {
  it("summarizes a player left of dealer ordering up", () => {
    const state = orderedState({ dealer: 0, orderingPlayer: 1 });

    const timeline = buildBiddingTimeline(state);

    expect(timeline).toMatchObject({
      dealer: 0,
      orderedBy: 1,
      pickedUpByDealer: false,
      finalTrumpSuit: "clubs",
      makerTeam: 1
    });
    expect(timeline.summaryText).toContain("West ordered South");
    expect(timeline.decisions.find((decision) => decision.seat === 1)).toMatchObject({ label: "ordered-up" });
  });

  it("labels dealer partner order-up as an assist", () => {
    const state = orderedState({ dealer: 0, orderingPlayer: 2 });

    const timeline = buildBiddingTimeline(state);

    expect(timeline.decisions.find((decision) => decision.seat === 2)).toMatchObject({ label: "assist" });
    expect(timeline.summaryText).toContain("assisted");
  });

  it("labels dealer voluntarily picking up", () => {
    let state = makeOrderingState({ dealer: 0 });
    state = dispatchAction(state, { type: "PASS", player: 1 });
    state = dispatchAction(state, { type: "PASS", player: 2 });
    state = dispatchAction(state, { type: "PASS", player: 3 });
    state = dispatchAction(state, { type: "ORDER_UP", player: 0 });

    const timeline = buildBiddingTimeline(state);

    expect(timeline.pickedUpByDealer).toBe(true);
    expect(timeline.decisions.find((decision) => decision.seat === 0)).toMatchObject({ label: "picked-up" });
    expect(timeline.summaryText).toContain("South picked up");
  });

  it("shows only the dealer turning down the upcard after everyone passes", () => {
    let state = makeOrderingState({ dealer: 0 });
    state = dispatchAction(state, { type: "PASS", player: 1 });
    state = dispatchAction(state, { type: "PASS", player: 2 });
    state = dispatchAction(state, { type: "PASS", player: 3 });
    state = dispatchAction(state, { type: "PASS", player: 0 });

    const timeline = buildBiddingTimeline(state);

    expect(timeline.turnedDownByDealer).toBe(true);
    expect(timeline.decisions.find((decision) => decision.label === "turned-down")?.seat).toBe(0);
    expect(timeline.decisions.filter((decision) => decision.label === "turned-down")).toHaveLength(1);
  });

  it("summarizes a round 2 caller and alone call", () => {
    let state = makeCallingState({ dealer: 0 });
    state = dispatchAction(state, { type: "CALL_TRUMP", player: 1, suit: "hearts", alone: true });

    const timeline = buildBiddingTimeline(state);

    expect(timeline).toMatchObject({
      calledBy: 1,
      calledSuit: "hearts",
      aloneSeat: 1,
      finalTrumpSuit: "hearts"
    });
    expect(timeline.summaryText).toContain("West called hearts in Round 2");
  });

  it("summarizes stick-the-dealer forced call", () => {
    let state = makeCallingState({ dealer: 0, stickDealer: true });
    state = dispatchAction(state, { type: "PASS", player: 1 });
    state = dispatchAction(state, { type: "PASS", player: 2 });
    state = dispatchAction(state, { type: "PASS", player: 3 });
    state = dispatchAction(state, { type: "CALL_TRUMP", player: 0, suit: "hearts" });

    const timeline = buildBiddingTimeline(state);

    expect(timeline.summaryText).toBe("Stick the Dealer: South forced to choose hearts.");
  });
});

function orderedState({ dealer, orderingPlayer }: { dealer: 0 | 1 | 2 | 3; orderingPlayer: 0 | 1 | 2 | 3 }): GameState {
  let state = makeOrderingState({ dealer });
  while (state.activePlayer !== orderingPlayer) {
    state = dispatchAction(state, { type: "PASS", player: state.activePlayer });
  }
  return dispatchAction(state, { type: "ORDER_UP", player: orderingPlayer });
}

function makeOrderingState({ dealer, stickDealer = false }: { dealer: 0 | 1 | 2 | 3; stickDealer?: boolean }): GameState {
  return {
    ...createInitialGameState({ stickDealer }),
    phase: "ordering",
    handNumber: 1,
    dealer,
    activePlayer: ((dealer + 1) % 4) as 0 | 1 | 2 | 3,
    upcard: c("9", "clubs"),
    turnedDownSuit: "clubs",
    hands: {
      0: [c("A", "clubs"), c("9", "hearts"), c("10", "spades"), c("Q", "diamonds"), c("K", "clubs")],
      1: [c("A", "hearts"), c("9", "diamonds"), c("10", "clubs"), c("Q", "spades"), c("K", "hearts")],
      2: [c("A", "spades"), c("9", "clubs"), c("10", "hearts"), c("Q", "clubs"), c("K", "spades")],
      3: [c("A", "diamonds"), c("9", "spades"), c("10", "diamonds"), c("Q", "hearts"), c("K", "diamonds")]
    },
    kitty: [c("9", "clubs"), c("J", "clubs"), c("Q", "clubs"), c("K", "clubs")]
  };
}

function makeCallingState({ dealer, stickDealer = false }: { dealer: 0 | 1 | 2 | 3; stickDealer?: boolean }): GameState {
  return {
    ...makeOrderingState({ dealer, stickDealer }),
    phase: "calling",
    activePlayer: ((dealer + 1) % 4) as 0 | 1 | 2 | 3,
    bids: [
      { round: 1, player: 1, decision: "pass" },
      { round: 1, player: 2, decision: "pass" },
      { round: 1, player: 3, decision: "pass" },
      { round: 1, player: 0, decision: "pass" }
    ]
  };
}
