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

    expect(view.legal.playableCardIds).toEqual(["9-hearts"]);
    expect(view.legal.selectableCardIds).toEqual(["9-hearts"]);
    expect(view.viewerHand.cards.map((candidate) => [candidate.id, candidate.legal])).toEqual([
      ["J-clubs", false],
      ["9-hearts", true],
      ["A-clubs", false]
    ]);
  });

  it("contains only the viewer hand and public trick cards", () => {
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
      kitty: [card("J", "diamonds"), card("10", "clubs"), card("9", "spades")],
      upcard: card("9", "spades"),
      currentTrick: {
        leader: 3,
        plays: [{ player: 3, card: card("10", "hearts") }]
      }
    });

    const serialized = JSON.stringify(buildClubTableView(state, 0));

    expect(serialized).toContain('"rank":"9","suit":"hearts"');
    expect(serialized).toContain('"rank":"10","suit":"hearts"');
    expect(serialized).not.toContain('"rank":"A","suit":"diamonds"');
    expect(serialized).not.toContain('"rank":"K","suit":"spades"');
    expect(serialized).not.toContain('"rank":"Q","suit":"clubs"');
    expect(serialized).not.toContain('"rank":"J","suit":"diamonds"');
    expect(serialized).not.toContain('"rank":"10","suit":"clubs"');
    expect(JSON.parse(serialized).publicKitty).toEqual({
      hiddenCardCount: 2,
      upcard: card("9", "spades")
    });
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
  it("redacts hidden dealer discard identity and mirrors authoritative legal actions", () => {
    const hiddenDiscard = card("A", "diamonds");
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "hearts",
      hands: { 0: [card("9", "clubs")] },
      currentTrick: { leader: 0, plays: [] },
      moveLog: [{
        id: "discard-event",
        sequence: 3,
        player: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        action: { type: "DISCARD", player: 2, card: hiddenDiscard }
      }]
    });

    const view = buildClubTableView(state, 0);
    const authoritative = legalActionsForPlayer(state, 0);
    const serialized = JSON.stringify(view);

    expect(view.legal.playableCardIds).toEqual(authoritative.playableCards.map((candidate) => `${candidate.rank}-${candidate.suit}`));
    expect(view.moveHistory[0].label).toBe("North discarded after pickup");
    expect(serialized).not.toContain('"rank":"A","suit":"diamonds"');
    expect(serialized).not.toContain("A♦");
  });

  it("produces distinct viewer hands without leaking another viewer's cards", () => {
    const state = makeState({
      phase: "playing",
      activePlayer: 0,
      trump: "spades",
      hands: {
        0: [card("A", "hearts")],
        1: [card("K", "diamonds")],
        2: [card("Q", "clubs")],
        3: [card("J", "spades")]
      },
      currentTrick: { leader: 0, plays: [] }
    });

    const south = JSON.stringify(buildClubTableView(state, 0));
    const west = JSON.stringify(buildClubTableView(state, 1));

    expect(south).toContain('"rank":"A","suit":"hearts"');
    expect(south).not.toContain('"rank":"K","suit":"diamonds"');
    expect(west).toContain('"rank":"K","suit":"diamonds"');
    expect(west).not.toContain('"rank":"A","suit":"hearts"');
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
