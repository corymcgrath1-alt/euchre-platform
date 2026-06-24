import { chooseBotAction, type BotProfile } from "./bots";
import { chooseIntermediateBotAction } from "./intermediate-bot";
import { legalActionsForPlayer } from "./rules";
import type { Card, GameAction, GameState, PlayerIndex } from "./types";

export type BotPolicyId = "basic-v1" | "legal-random-v1" | "intermediate-v1";

export type BotPolicyMetadata = {
  id: BotPolicyId;
  name: string;
  version: string;
  description: string;
  deterministic: boolean;
  usesSeededRng: boolean;
};

export type BotPolicyContext = {
  random: () => number;
  nextSeed: () => number;
};

export type BotPolicy = {
  metadata: BotPolicyMetadata;
  chooseAction: (state: GameState, bot: BotProfile, context: BotPolicyContext) => GameAction | null;
};

export const DEFAULT_BOT_POLICY_ID: BotPolicyId = "basic-v1";

const BASIC_V1: BotPolicy = {
  metadata: {
    id: "basic-v1",
    name: "Basic v1",
    version: "1.0.0",
    description: "Current deterministic heuristic bot behavior preserved from the pre-policy implementation.",
    deterministic: true,
    usesSeededRng: false
  },
  chooseAction(state, bot) {
    return chooseBotAction(state, bot, state.config.botDifficulty);
  }
};

const LEGAL_RANDOM_V1: BotPolicy = {
  metadata: {
    id: "legal-random-v1",
    name: "Legal Random v1",
    version: "1.0.0",
    description: "Seeded legal-action baseline for rule stress testing; not intended to play strong Euchre.",
    deterministic: true,
    usesSeededRng: true
  },
  chooseAction(state, bot, context) {
    if (!bot.enabled || state.activePlayer !== bot.seat) {
      return null;
    }

    const actions = legalRandomActions(state, bot.seat, context);
    return chooseRandom(actions, context.random);
  }
};

const INTERMEDIATE_V1: BotPolicy = {
  metadata: {
    id: "intermediate-v1",
    name: "Intermediate v1",
    version: "1.0.0",
    description: "Simple deterministic heuristic bot with hand-strength bidding, position awareness, and selective loners.",
    deterministic: true,
    usesSeededRng: false
  },
  chooseAction(state, bot) {
    return chooseIntermediateBotAction(state, bot);
  }
};

const BOT_POLICIES: Record<BotPolicyId, BotPolicy> = {
  "basic-v1": BASIC_V1,
  "legal-random-v1": LEGAL_RANDOM_V1,
  "intermediate-v1": INTERMEDIATE_V1
};

export function getBotPolicy(id: BotPolicyId): BotPolicy {
  const policy = BOT_POLICIES[id];
  if (!policy) {
    throw new Error(`Unknown bot policy '${String(id)}'. Available policies: ${listBotPolicies().map((item) => item.id).join(", ")}`);
  }

  return policy;
}

export function listBotPolicies(): BotPolicyMetadata[] {
  return Object.values(BOT_POLICIES).map((policy) => policy.metadata);
}

export function isBotPolicyId(value: string): value is BotPolicyId {
  return value in BOT_POLICIES;
}

export function assertBotPolicyId(value: string): BotPolicyId {
  if (isBotPolicyId(value)) {
    return value;
  }

  throw new Error(`Unknown bot policy '${value}'. Available policies: ${listBotPolicies().map((policy) => policy.id).join(", ")}`);
}

function legalRandomActions(state: GameState, player: PlayerIndex, context: BotPolicyContext): GameAction[] {
  const legal = legalActionsForPlayer(state, player);
  const actions: GameAction[] = [];

  if (legal.canClaimFarmersHand) {
    if (state.config.farmersHandMode === "redeal") {
      actions.push({ type: "FARMERS_HAND_REDEAL", player, seed: context.nextSeed() });
    }
    if (state.config.farmersHandMode === "replaceThree") {
      const replacement = chooseReplacementCards(legal.farmersHandReplaceableCards, state.kitty.length, context.random);
      if (replacement.length) {
        actions.push({ type: "FARMERS_HAND_REPLACE", player, cards: replacement });
      }
    }
  }
  if (legal.canDeclineFarmersHand) {
    actions.push({ type: "FARMERS_HAND_DECLINE", player });
  }

  if (legal.canPass) {
    actions.push({ type: "PASS", player });
  }
  if (legal.canOrderUp && state.upcard) {
    actions.push({ type: "ORDER_UP", player, alone: randomBoolean(context.random, 0.08) });
  }
  for (const suit of legal.callableSuits) {
    actions.push({ type: "CALL_TRUMP", player, suit, alone: randomBoolean(context.random, 0.08) });
  }
  if (legal.mustDiscard) {
    const card = chooseRandom(state.hands[player], context.random);
    if (card) {
      actions.push({ type: "DISCARD", player, card });
    }
  }
  if (state.phase === "playing") {
    const card = chooseRandom(legal.playableCards, context.random);
    if (card) {
      actions.push({ type: "PLAY_CARD", player, card });
    }
  }

  return actions;
}

function chooseReplacementCards(cards: Card[], kittySize: number, random: () => number): Card[] {
  const max = Math.min(3, Math.max(0, kittySize - 1), cards.length);
  if (max <= 0) {
    return [];
  }

  const count = 1 + Math.floor(random() * max);
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

function chooseRandom<T>(items: T[], random: () => number): T | null {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(random() * items.length)] ?? items[0];
}

function randomBoolean(random: () => number, probability: number): boolean {
  return random() < probability;
}

export function policyIdsForCli(): string {
  return listBotPolicies().map((policy) => policy.id).join(", ");
}
