import { describe, expect, it } from "vitest";
import { chooseBotAction, type BotProfile } from "./bots";
import { cardId } from "./cards";
import { seededRandom } from "./deck";
import { createInitialGameState, dispatchAction } from "./engine";
import {
  DEFAULT_BOT_POLICY_ID,
  assertBotPolicyId,
  getBotPolicy,
  listBotPolicies
} from "./bot-policies";
import { legalActionsForPlayer } from "./rules";
import type { GameAction, GameState, PlayerIndex } from "./types";

describe("bot policies", () => {
  it("registers basic-v1 as the default policy", () => {
    expect(DEFAULT_BOT_POLICY_ID).toBe("basic-v1");
    expect(listBotPolicies().map((policy) => policy.id)).toEqual(["basic-v1", "legal-random-v1"]);
    expect(getBotPolicy(DEFAULT_BOT_POLICY_ID).metadata.name).toBe("Basic v1");
  });

  it("preserves current bot behavior through basic-v1", () => {
    const state = dispatchAction(createInitialGameState({ stickDealer: true, targetScore: 10 }), {
      type: "START_HAND",
      seed: 12345
    });
    const bot = botForSeat(state.activePlayer);
    const expected = chooseBotAction(state, bot, state.config.botDifficulty);
    const actual = getBotPolicy("basic-v1").chooseAction(state, bot, {
      random: seededRandom(1),
      nextSeed: () => 1
    });

    expect(actual).toEqual(expected);
  });

  it("legal-random-v1 selects only legal actions from bidding states", () => {
    const policy = getBotPolicy("legal-random-v1");
    const random = seededRandom(222);
    let state = dispatchAction(createInitialGameState({ stickDealer: true, targetScore: 10 }), {
      type: "START_HAND",
      seed: 54321
    });

    for (let index = 0; index < 8 && state.phase !== "playing"; index += 1) {
      const action = policy.chooseAction(state, botForSeat(state.activePlayer), {
        random,
        nextSeed: () => Math.floor(random() * 1_000_000_000)
      });
      expect(action).not.toBeNull();
      assertLegalAction(state, action);
      state = dispatchAction(state, action);
    }
  });

  it("rejects unknown bot policy ids with available policy names", () => {
    expect(() => assertBotPolicyId("missing-v1")).toThrow("Available policies: basic-v1, legal-random-v1");
  });
});

function botForSeat(seat: PlayerIndex): BotProfile {
  return {
    id: `test-seat-${seat}`,
    name: `Seat ${seat}`,
    seat,
    enabled: true
  };
}

function assertLegalAction(state: GameState, action: GameAction | null): asserts action is GameAction {
  expect(action).not.toBeNull();
  if (!action) {
    return;
  }

  const player = "player" in action ? action.player : state.activePlayer;
  const legal = legalActionsForPlayer(state, player);

  switch (action.type) {
    case "FARMERS_HAND_DECLINE":
      expect(legal.canDeclineFarmersHand).toBe(true);
      break;
    case "FARMERS_HAND_REDEAL":
      expect(legal.canClaimFarmersHand).toBe(true);
      expect(state.config.farmersHandMode).toBe("redeal");
      break;
    case "FARMERS_HAND_REPLACE":
      expect(legal.canClaimFarmersHand).toBe(true);
      expect(state.config.farmersHandMode).toBe("replaceThree");
      for (const card of action.cards) {
        expect(legal.farmersHandReplaceableCards.map(cardId)).toContain(cardId(card));
      }
      break;
    case "PASS":
      expect(legal.canPass).toBe(true);
      break;
    case "ORDER_UP":
      expect(legal.canOrderUp).toBe(true);
      break;
    case "CALL_TRUMP":
      expect(legal.callableSuits).toContain(action.suit);
      break;
    case "DISCARD":
      expect(legal.mustDiscard).toBe(true);
      expect(state.hands[player].map(cardId)).toContain(cardId(action.card));
      break;
    case "PLAY_CARD":
      expect(legal.playableCards.map(cardId)).toContain(cardId(action.card));
      break;
    case "START_HAND":
      expect(state.phase).toBe("idle");
      break;
    case "NEXT_HAND":
      expect(state.phase).toBe("handComplete");
      break;
    case "RESET_GAME":
      throw new Error("legal-random-v1 should not reset games");
    default:
      action satisfies never;
  }
}
