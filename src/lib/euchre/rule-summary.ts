import { cardLabel } from "./cards";
import { normalizeGameConfig } from "./engine";
import type {
  BotDifficulty,
  DealerSelection,
  FarmersHandMode,
  GameAction,
  GameConfig,
  LonerMode,
  PlayerIndex
} from "./types";

export const FARMERS_HAND_QUALIFIER_TEXT = "Hand contains only 9s and 10s; no A, K, Q, or J.";

export interface RuleSummaryEvent {
  eventType: GameAction["type"];
  payload: GameAction;
}

export interface RuleSummaryItem {
  label: string;
  value: string;
  detail?: string;
}

export interface RuleSummary {
  config: GameConfig;
  targetScoreLabel: string;
  botDifficultyLabel: string;
  dealerSelectionLabel: string;
  initialDealerLabel?: string;
  stickDealerLabel: string;
  farmersHandModeLabel: string;
  farmersHandQualifierText: string;
  lonerModeLabel: string;
  seed?: number;
  seedLabel: string;
  warnings: string[];
  defaultsApplied: boolean;
  items: RuleSummaryItem[];
}

export interface ParsedSeed {
  seed: number;
  source: "input" | "generated";
}

const CONFIG_KEYS: Array<keyof GameConfig> = [
  "stickDealer",
  "targetScore",
  "botDifficulty",
  "dealerSelection",
  "farmersHandMode",
  "lonerMode"
];

export function buildRuleSummary(
  config: Partial<GameConfig> = {},
  options: {
    events?: RuleSummaryEvent[];
    seed?: number;
    initialDealer?: PlayerIndex;
  } = {}
): RuleSummary {
  const normalized = normalizeGameConfig(config);
  const seed = options.seed ?? firstSeedFromEvents(options.events ?? []);
  const warnings = ruleWarnings(normalized);
  const initialDealerLabel = options.initialDealer === undefined ? undefined : seatLabel(options.initialDealer);
  const summary: RuleSummary = {
    config: normalized,
    targetScoreLabel: String(normalized.targetScore),
    botDifficultyLabel: formatBotDifficulty(normalized.botDifficulty),
    dealerSelectionLabel: formatDealerSelection(normalized.dealerSelection),
    initialDealerLabel,
    stickDealerLabel: normalized.stickDealer ? "On" : "Off",
    farmersHandModeLabel: formatFarmersHandMode(normalized.farmersHandMode),
    farmersHandQualifierText: FARMERS_HAND_QUALIFIER_TEXT,
    lonerModeLabel: formatLonerMode(normalized.lonerMode),
    seed,
    seedLabel: formatSeed(seed),
    warnings,
    defaultsApplied: CONFIG_KEYS.some((key) => config[key] === undefined),
    items: []
  };

  summary.items = [
    { label: "Target", value: summary.targetScoreLabel },
    { label: "Bots", value: summary.botDifficultyLabel },
    {
      label: "Dealer",
      value: initialDealerLabel
        ? `${summary.dealerSelectionLabel} (${initialDealerLabel})`
        : summary.dealerSelectionLabel
    },
    { label: "Stick dealer", value: summary.stickDealerLabel },
    {
      label: "Farmer",
      value: summary.farmersHandModeLabel,
      detail: summary.farmersHandQualifierText
    },
    { label: "Loner", value: summary.lonerModeLabel },
    { label: "Seed", value: summary.seedLabel }
  ];

  return summary;
}

export function parsePracticeSeed(input: string, generatedSeed = Date.now() % 1_000_000): ParsedSeed {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { seed: normalizeSeed(generatedSeed), source: "generated" };
  }

  const parsed = Number(trimmed);
  if (Number.isInteger(parsed) && Number.isFinite(parsed)) {
    return { seed: normalizeSeed(parsed), source: "input" };
  }

  return { seed: normalizeSeed(generatedSeed), source: "generated" };
}

export function firstSeedFromEvents(events: RuleSummaryEvent[]): number | undefined {
  const firstDeal = events.find((event) => (
    event.eventType === "START_HAND" &&
    event.payload.type === "START_HAND"
  ));

  return firstDeal?.payload.type === "START_HAND" ? firstDeal.payload.seed : undefined;
}

export function formatSeed(seed: number | undefined): string {
  return seed === undefined ? "Not recorded" : String(seed);
}

export function formatBotDifficulty(difficulty: BotDifficulty = "standard"): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function formatDealerSelection(selection: DealerSelection): string {
  switch (selection) {
    case "human":
      return "Human";
    case "seat0":
      return "Seat 0";
    case "seat1":
      return "Seat 1";
    case "seat2":
      return "Seat 2";
    case "seat3":
      return "Seat 3";
    case "default":
    default:
      return "Default";
  }
}

export function formatFarmersHandMode(mode: FarmersHandMode): string {
  switch (mode) {
    case "redeal":
      return "Redeal";
    case "replaceThree":
      return "Replace three";
    case "off":
    default:
      return "Off";
  }
}

export function formatLonerMode(mode: LonerMode): string {
  return mode === "withPartnerAllowed" ? "Assisted variant (deferred)" : "Alone only";
}

export function ruleWarnings(config: GameConfig): string[] {
  return config.lonerMode === "withPartnerAllowed"
    ? ["Assisted-loner gameplay is stored for future support; current play and scoring remain standard loner rules."]
    : [];
}

export function replacementSelectionLabel(selectedCards: Array<Parameters<typeof cardLabel>[0]>): string {
  return selectedCards.length === 0
    ? "No cards selected"
    : selectedCards.map(cardLabel).join(", ");
}

function normalizeSeed(seed: number): number {
  return Math.abs(seed) % 1_000_000;
}

function seatLabel(seat: PlayerIndex): string {
  return `Seat ${seat}`;
}
