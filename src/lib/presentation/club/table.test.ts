import { describe, expect, it } from "vitest";
import { createInitialGameState, legalActionsForPlayer, type Card, type GameState } from "@/lib/euchre";
import { buildClubTableView } from "./table";

const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("Club table presentation", () => {
  it("passes through engine legality and never marks illegal cards playable", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "spades",
      hands: {
        0: [card("9", "hearts"), card("A", "clubs"), card("J", "clubs")],
        1: [card("A", "diamonds")],
        2: [card("K", "diamonds")],
        3: [card("Q", "diamonds")]
      },
      currentTrick: {
        leader: 1,
        plays: [{ player: 1, card: card("A", "hearts") }]
      }
    });

    const view = buildClubTableView(state, 0);
    const authoritative = legalActionsForPlayer(state, 0);

    expect(view.legal.playableCardIds).toEqual(authoritative.playableCards.map((candidate) => `${candidate.rank}-${candidate.suit}`));
    expect(view.legal.playableCardIds).toEqual(["9-hearts"]);
    expect(view.legal.selectableCardIds).toEqual(["9-hearts"]);
    expect(view.viewerHand.cards.map((candidate) => [candidate.id, candidate.legal])).toEqual([
      ["J-clubs", false],
      ["9-hearts", true],
      ["A-clubs", false]
    ]);
  });

  it("contains only the viewer hand and public trick or upcard identities", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "clubs",
      hands: {
        0: [card("9", "hearts")],
        1: [card("A", "diamonds")],
        2: [card("K", "spades")],
        3: [card("Q", "clubs")]
      },
      kitty: [card("9", "clubs"), card("10", "clubs"), card("Q", "diamonds"), card("K", "hearts")],
      upcard: card("9", "clubs"),
      currentTrick: {
        leader: 3,
        plays: [{ player: 3, card: card("10", "hearts") }]
      }
    });

    const view = buildClubTableView(state, 0);
    const serialized = JSON.stringify(view);

    expect(serialized).toContain('"rank":"9","suit":"hearts"');
    expect(serialized).toContain('"rank":"10","suit":"hearts"');
    expect(serialized).toContain('"rank":"9","suit":"clubs"');
    expect(serialized).not.toContain('"rank":"A","suit":"diamonds"');
    expect(serialized).not.toContain('"rank":"K","suit":"spades"');
    expect(serialized).not.toContain('"rank":"Q","suit":"clubs"');
    expect(serialized).not.toContain('"rank":"10","suit":"clubs"');
    expect(serialized).not.toContain('"rank":"Q","suit":"diamonds"');
    expect(serialized).not.toContain('"rank":"K","suit":"hearts"');
    expect(view.kittyCardCount).toBe(4);
    expect(view.publicKitty).toEqual({ hiddenCardCount: 3, upcard: card("9", "clubs") });
  });

  it("removes deal seeds and hidden discard or replacement identities from every activity surface", () => {
    const state = makeState({
      moveLog: [
        move(0, { type: "START_HAND", seed: 90210 }),
        move(1, { type: "DISCARD", player: 1, card: card("A", "diamonds") }),
        move(2, { type: "FARMERS_HAND_REPLACE", player: 2, cards: [card("9", "clubs"), card("10", "clubs")] })
      ]
    });

    const view = buildClubTableView(state, 0);
    const serialized = JSON.stringify(view);

    expect(view.activity.map((item) => item.label)).toEqual([
      "Started a new hand",
      "West discarded after pickup",
      "North replaced 2 Farmer's Hand cards"
    ]);
    expect(view.moveHistory.map((item) => item.label)).toEqual(view.activity.map((item) => item.label));
    expect(view.seats.find((seat) => seat.seat === 1)?.recentAction).toBe("West discarded after pickup");
    expect(view.rules.seed).toBeUndefined();
    expect(view.summary.rules.seed).toBeUndefined();
    expect(view.rules.items.some((item) => item.label === "Seed")).toBe(false);
    expect(serialized).not.toContain("90210");
    expect(serialized).not.toContain('"rank":"A","suit":"diamonds"');
    expect(serialized).not.toContain('"rank":"9","suit":"clubs"');
    expect(serialized).not.toContain('"rank":"10","suit":"clubs"');
  });

  it("gives different viewers only their own cloned hand", () => {
    const state = makeState({
      hands: {
        0: [card("A", "hearts")],
        1: [card("K", "spades")],
        2: [card("Q", "diamonds")],
        3: [card("J", "clubs")]
      }
    });

    const south = buildClubTableView(state, 0);
    const north = buildClubTableView(state, 2);
    expect(south.viewerHand.cards.map((candidate) => candidate.id)).toEqual(["A-hearts"]);
    expect(north.viewerHand.cards.map((candidate) => candidate.id)).toEqual(["Q-diamonds"]);
    expect(JSON.stringify(north)).not.toContain('"rank":"A","suit":"hearts"');
    expect(JSON.stringify(south)).not.toContain('"rank":"Q","suit":"diamonds"');
  });

  it("orients real seats around any viewer while preserving authoritative roles", () => {
    const state = makeState({
      phase: "playing",
      dealer: 0,
      activePlayer: 3,
      trump: "diamonds",
      maker: 2,
      makerTeam: 0,
      lonePlayer: 2
    });

    const view = buildClubTableView(state, 2);

    expect(view.seats.map((seat) => [seat.seat, seat.position])).toEqual([
      [0, "north"],
      [1, "east"],
      [2, "south"],
      [3, "west"]
    ]);
    expect(view).toMatchObject({
      dealer: 0,
      activePlayer: 3,
      trump: "diamonds",
      maker: 2,
      makerPartnership: 0,
      lonePlayer: 2,
      sittingOutPartner: 0
    });
    expect(view.seats.find((seat) => seat.seat === 0)).toMatchObject({ isDealer: true, isSittingOut: true });
    expect(view.seats.find((seat) => seat.seat === 2)).toMatchObject({ isViewer: true, isCaller: true });
  });

  it("is deterministic and cannot mutate source engine cards through its output", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "hearts",
      hands: { 0: [card("A", "hearts")] },
      currentTrick: { leader: 0, plays: [] }
    });
    const first = buildClubTableView(state, 0);
    const second = buildClubTableView(state, 0);

    expect(first).toEqual(second);
    first.viewerHand.cards[0].card.rank = "9";
    expect(state.hands[0][0]).toEqual(card("A", "hearts"));
    expect(second.viewerHand.cards[0].card).toEqual(card("A", "hearts"));
  });

  it("keeps compatibility aliases equal without sharing mutable arrays", () => {
    const state = makeState({
      phase: "ordering",
      activePlayer: 1,
      upcard: card("Q", "hearts"),
      kitty: [card("Q", "hearts")]
    });

    const view = buildClubTableView(state, 0);

    expect(view.biddingTimeline).toEqual(view.bidding);
    expect(view.turnPrompt).toEqual(view.turn);
    expect(view.summary.rules).toEqual(view.rules);
    expect(view.biddingTimeline).not.toBe(view.bidding);
    expect(view.summary.rules).not.toBe(view.rules);
  });
});

type StateOverrides = Omit<Partial<GameState>, "config" | "hands"> & {
  config?: Partial<GameState["config"]>;
  hands?: Partial<GameState["hands"]>;
};

function makeState(overrides: StateOverrides = {}): GameState {
  const base = createInitialGameState(overrides.config);

  return {
    ...base,
    ...overrides,
    config: { ...base.config, ...overrides.config },
    hands: { ...base.hands, ...overrides.hands }
  };
}

function move(sequence: number, action: GameState["moveLog"][number]["action"]): GameState["moveLog"][number] {
  return {
    id: `event-${sequence}`,
    sequence,
    action,
    player: "player" in action ? action.player : undefined,
    createdAt: `2026-01-01T00:00:0${sequence}.000Z`
  };
}
