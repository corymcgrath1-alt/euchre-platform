import { describe, expect, it } from "vitest";
import { createInitialGameState, dispatchAction } from "../engine";
import type { GameState } from "../types";
import { checkGameInvariants } from "./invariants";

describe("playtest invariant checker", () => {
  it("accepts a valid initialized game", () => {
    const state = createInitialGameState();

    expect(checkGameInvariants(state)).toEqual([]);
  });

  it("catches duplicate cards in live play zones", () => {
    const dealt = dispatchAction(createInitialGameState(), { type: "START_HAND", seed: 123 });
    const duplicate = dealt.hands[0][0];
    const corrupted: GameState = {
      ...dealt,
      hands: {
        ...dealt.hands,
        1: [duplicate, ...dealt.hands[1]]
      }
    };

    expect(checkGameInvariants(corrupted).map((violation) => violation.code)).toContain("duplicate-card");
  });

  it("catches invalid phases when corrupted state is supplied", () => {
    const corrupted = {
      ...createInitialGameState(),
      phase: "between-hands"
    } as unknown as GameState;

    expect(checkGameInvariants(corrupted).map((violation) => violation.code)).toContain("invalid-phase");
  });
});
