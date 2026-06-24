export type PlaytestComparisonInput = {
  label: string;
  summary: unknown;
};

export type MetricCategory =
  | "runHealth"
  | "outcomes"
  | "bidding"
  | "makerDefender"
  | "loner"
  | "seatDealer"
  | "metadata";

export type MetricComparison = {
  key: string;
  label: string;
  category: MetricCategory;
  a: number | string | boolean | null;
  b: number | string | boolean | null;
  delta?: number | null;
  unit?: "count" | "rate" | "percentagePoints" | "hands" | "milliseconds" | "ratio" | "text";
  warning?: string;
};

export type PlaytestComparisonRunIdentity = {
  label: string;
  botPolicy?: string | null;
  botPolicyVersion?: string | null;
  games?: number | null;
  seed?: string | number | null;
  invariants?: string | null;
};

export type PlaytestComparisonReport = {
  generatedAt: string;
  a: PlaytestComparisonRunIdentity;
  b: PlaytestComparisonRunIdentity;
  metrics: MetricComparison[];
  warnings: string[];
};

type SummaryRecord = Record<string, unknown>;

type NumericMetricDefinition = {
  key: string;
  label: string;
  category: MetricCategory;
  unit: NonNullable<MetricComparison["unit"]>;
  paths: string[][];
  optional?: boolean;
  derive?: (summary: SummaryRecord) => number | null;
};

type TextMetricDefinition = {
  key: string;
  label: string;
  category: MetricCategory;
  paths: string[][];
  optional?: boolean;
};

const SEATS = ["0", "1", "2", "3"] as const;

const TEXT_METRICS: TextMetricDefinition[] = [
  textMetric("botPolicy", "Bot policy", "metadata", [["botPolicy", "id"], ["comparison", "botPolicy"], ["metrics", "botPolicyId"], ["config", "botPolicy"]]),
  textMetric("botPolicyVersion", "Bot policy version", "metadata", [["botPolicy", "version"], ["comparison", "botPolicyVersion"], ["metrics", "botPolicyVersion"]], { optional: true }),
  textMetric("seed", "Seed", "metadata", [["config", "seed"], ["metrics", "seed"]]),
  textMetric("targetScore", "Target score", "metadata", [["config", "targetScore"], ["metrics", "targetScore"]]),
  textMetric("stickDealer", "Stick dealer", "metadata", [["config", "stickDealer"], ["metrics", "stickDealer"]]),
  textMetric("invariants", "Invariant mode", "metadata", [["config", "invariants"], ["metrics", "invariantMode"]])
];

const NUMERIC_METRICS: NumericMetricDefinition[] = [
  metric("completedGames", "Completed games", "runHealth", "count", [["completedGames"], ["metrics", "completedGames"], ["comparison", "completedGames"]]),
  metric("failedGames", "Failed games", "runHealth", "count", [["failedGames"], ["metrics", "failedGames"], ["comparison", "failedGames"]]),
  metric("totalHands", "Total hands", "runHealth", "hands", [["totalHands"], ["metrics", "totalHands"]]),
  metric("elapsedMs", "Runtime", "runHealth", "milliseconds", [["elapsedMs"], ["metrics", "elapsedMs"]], { optional: true }),
  metric("averageHandsPerGame", "Average hands/game", "runHealth", "ratio", [["comparison", "averageHandsPerGame"], ["metrics", "averageHandsPerGame"]]),
  metric("team0WinRate", "Team 0 win rate", "outcomes", "percentagePoints", [["comparison", "teamWinRates", "northSouth"], ["metrics", "teamWinRates", "0"]]),
  metric("team1WinRate", "Team 1 win rate", "outcomes", "percentagePoints", [["comparison", "teamWinRates", "eastWest"], ["metrics", "teamWinRates", "1"]]),
  {
    key: "teamSkew",
    label: "Team skew",
    category: "outcomes",
    unit: "percentagePoints",
    paths: [],
    derive: (summary) => {
      const team0 = numberAt(summary, [["comparison", "teamWinRates", "northSouth"], ["metrics", "teamWinRates", "0"]]);
      const team1 = numberAt(summary, [["comparison", "teamWinRates", "eastWest"], ["metrics", "teamWinRates", "1"]]);
      return team0 === null || team1 === null ? null : round(team0 - team1);
    }
  },
  metric("closeGameRate", "Close game rate", "outcomes", "percentagePoints", [["comparison", "closeGameRate"], ["metrics", "closeGameRate"]], { optional: true }),
  metric("blowoutRate", "Blowout rate", "outcomes", "percentagePoints", [["comparison", "blowoutRate"], ["metrics", "blowoutRate"]], { optional: true }),
  metric("roundOneCallRate", "Round 1 call rate", "bidding", "percentagePoints", [["comparison", "roundOneCallRate"], ["metrics", "roundOneCallRate"]]),
  metric("roundTwoCallRate", "Round 2 call rate", "bidding", "percentagePoints", [["comparison", "roundTwoCallRate"], ["metrics", "roundTwoCallRate"]]),
  metric("dealerPickupRate", "Dealer pickup rate", "bidding", "percentagePoints", [["metrics", "dealerPickupRate"]], { optional: true }),
  metric("passoutRate", "Pass-out rate", "bidding", "percentagePoints", [["metrics", "passoutRate"]], { optional: true }),
  metric("stickDealerRate", "Stick-dealer rate", "bidding", "percentagePoints", [["comparison", "stickDealerRate"], ["metrics", "stickDealerRate"]], { optional: true }),
  metric("makerWinRate", "Maker win rate", "makerDefender", "percentagePoints", [["comparison", "makerWinRate"], ["metrics", "makerWinRate"]]),
  metric("euchreRate", "Euchre rate", "makerDefender", "percentagePoints", [["comparison", "euchreRate"], ["metrics", "makerEuchreRate"]]),
  metric("marchRate", "March/sweep rate", "makerDefender", "percentagePoints", [["comparison", "marchRate"], ["metrics", "makerMarchSweepRate"], ["metrics", "makerMarchRate"]]),
  metric("averageMakerTricks", "Average maker tricks", "makerDefender", "ratio", [["metrics", "averageMakerTricks"]], { optional: true }),
  metric("averageDefenderTricks", "Average defender tricks", "makerDefender", "ratio", [["metrics", "averageDefenderTricks"]], { optional: true }),
  metric("defenderEuchreRate", "Defender euchre rate", "makerDefender", "percentagePoints", [["metrics", "defenderEuchreRate"]], { optional: true }),
  metric("loneAttemptCount", "Loner attempts", "loner", "count", [["metrics", "loneAttemptCount"]], { optional: true }),
  metric("loneSuccessCount", "Loner successes", "loner", "count", [["metrics", "loneSuccessCount"]], { optional: true }),
  metric("loneAttemptRate", "Loner attempt rate", "loner", "percentagePoints", [["comparison", "loneAttemptRate"], ["metrics", "loneAttemptRate"]], { optional: true }),
  metric("loneSuccessRate", "Loner success rate", "loner", "percentagePoints", [["comparison", "loneSuccessRate"], ["metrics", "loneSuccessRate"]], { optional: true }),
  metric("loneEuchreRate", "Loner euchre rate", "loner", "percentagePoints", [["metrics", "loneEuchreRate"]], {
    optional: true,
    derive: (summary) => {
      const euchres = numberAt(summary, [["metrics", "loneEuchreCount"]]);
      const attempts = numberAt(summary, [["metrics", "loneAttemptCount"]]);
      return euchres === null || attempts === null || attempts === 0 ? null : round(euchres / attempts);
    }
  })
];

export function comparePlaytestRuns(
  a: PlaytestComparisonInput,
  b: PlaytestComparisonInput
): PlaytestComparisonReport {
  const aSummary = assertValidSummary(a.summary, a.label);
  const bSummary = assertValidSummary(b.summary, b.label);
  const warnings: string[] = [];
  const metrics = [
    ...TEXT_METRICS.map((definition) => compareTextMetric(definition, aSummary, bSummary, warnings)),
    ...NUMERIC_METRICS.map((definition) => compareNumericMetric(definition, aSummary, bSummary, warnings)),
    ...seatMetrics(aSummary, bSummary, warnings)
  ].filter((comparison) => comparison.warning || comparison.a !== null || comparison.b !== null);

  return {
    generatedAt: new Date().toISOString(),
    a: runIdentity(a.label, aSummary),
    b: runIdentity(b.label, bSummary),
    metrics,
    warnings
  };
}

export function formatPlaytestComparisonReport(report: PlaytestComparisonReport): string {
  const lines = [
    "Playtest Comparison Report",
    "==========================",
    "",
    `A: ${formatIdentity(report.a)}`,
    `B: ${formatIdentity(report.b)}`,
    ""
  ];

  const categories: MetricCategory[] = ["runHealth", "outcomes", "bidding", "makerDefender", "loner", "seatDealer", "metadata"];
  for (const category of categories) {
    const categoryMetrics = report.metrics.filter((item) => item.category === category);
    if (!categoryMetrics.length) {
      continue;
    }

    const title = categoryTitle(category);
    lines.push(title, "-".repeat(title.length), formatTable(categoryMetrics), "");
  }

  if (report.warnings.length) {
    lines.push("Warnings", "--------");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function compareTextMetric(
  definition: TextMetricDefinition,
  aSummary: SummaryRecord,
  bSummary: SummaryRecord,
  warnings: string[]
): MetricComparison {
  const aValue = textAt(aSummary, definition.paths);
  const bValue = textAt(bSummary, definition.paths);
  const warning = warningForMissing(definition.label, aValue, bValue, definition.optional);
  if (warning) {
    warnings.push(warning);
  }

  return {
    key: definition.key,
    label: definition.label,
    category: definition.category,
    a: aValue,
    b: bValue,
    delta: null,
    unit: "text",
    warning
  };
}

function compareNumericMetric(
  definition: NumericMetricDefinition,
  aSummary: SummaryRecord,
  bSummary: SummaryRecord,
  warnings: string[]
): MetricComparison {
  const aValue = valueForNumericMetric(definition, aSummary);
  const bValue = valueForNumericMetric(definition, bSummary);
  const warning = warningForMissing(definition.label, aValue, bValue, definition.optional);
  if (warning) {
    warnings.push(warning);
  }

  return {
    key: definition.key,
    label: definition.label,
    category: definition.category,
    a: aValue,
    b: bValue,
    delta: aValue === null || bValue === null ? null : round(bValue - aValue),
    unit: definition.unit,
    warning
  };
}

function seatMetrics(
  aSummary: SummaryRecord,
  bSummary: SummaryRecord,
  warnings: string[]
): MetricComparison[] {
  const definitions = [
    {
      keyPrefix: "makerSuccessRateBySeat",
      labelSuffix: "maker success rate",
      unit: "percentagePoints" as const,
      path: ["metrics", "makerSuccessRateBySeat"]
    },
    {
      keyPrefix: "euchreRateByMakerSeat",
      labelSuffix: "maker euchre rate",
      unit: "percentagePoints" as const,
      path: ["metrics", "euchreRateByMakerSeat"]
    },
    {
      keyPrefix: "handWinRateByDealerSeat",
      labelSuffix: "dealer hand win rate",
      unit: "percentagePoints" as const,
      path: ["metrics", "handWinRateByDealerSeat"]
    },
    {
      keyPrefix: "callerSeatDistribution",
      labelSuffix: "caller count",
      unit: "count" as const,
      path: ["metrics", "callerSeatDistribution"]
    }
  ];

  return definitions.flatMap((definition) => SEATS.map((seat) => {
    const label = `Seat ${seat} ${definition.labelSuffix}`;
    const aValue = numberAt(aSummary, [[...definition.path, seat]]);
    const bValue = numberAt(bSummary, [[...definition.path, seat]]);
    const warning = warningForMissing(label, aValue, bValue, true);
    if (warning) {
      warnings.push(warning);
    }

    return {
      key: `${definition.keyPrefix}.${seat}`,
      label,
      category: "seatDealer" as const,
      a: aValue,
      b: bValue,
      delta: aValue === null || bValue === null ? null : round(bValue - aValue),
      unit: definition.unit,
      warning
    };
  }));
}

function runIdentity(label: string, summary: SummaryRecord): PlaytestComparisonRunIdentity {
  return {
    label,
    botPolicy: textAt(summary, [["botPolicy", "id"], ["comparison", "botPolicy"], ["metrics", "botPolicyId"], ["config", "botPolicy"]]),
    botPolicyVersion: textAt(summary, [["botPolicy", "version"], ["comparison", "botPolicyVersion"], ["metrics", "botPolicyVersion"]]),
    games: numberAt(summary, [["totalGames"], ["metrics", "totalGames"], ["comparison", "games"], ["config", "games"]]),
    seed: textOrNumberAt(summary, [["config", "seed"], ["metrics", "seed"]]),
    invariants: textAt(summary, [["config", "invariants"], ["metrics", "invariantMode"]])
  };
}

function assertValidSummary(summary: unknown, label: string): SummaryRecord {
  if (!isRecord(summary)) {
    throw new Error(`Invalid playtest summary for ${label}: expected a JSON object`);
  }

  if (!("totalGames" in summary || "completedGames" in summary || "metrics" in summary || "comparison" in summary || "config" in summary)) {
    throw new Error(`Invalid playtest summary for ${label}: missing playtest run fields`);
  }

  return summary;
}

function valueForNumericMetric(definition: NumericMetricDefinition, summary: SummaryRecord): number | null {
  const derived = definition.derive?.(summary);
  return derived ?? numberAt(summary, definition.paths);
}

function metric(
  key: string,
  label: string,
  category: MetricCategory,
  unit: NonNullable<MetricComparison["unit"]>,
  paths: string[][],
  options: Pick<NumericMetricDefinition, "optional" | "derive"> = {}
): NumericMetricDefinition {
  return {
    key,
    label,
    category,
    unit,
    paths,
    ...options
  };
}

function textMetric(
  key: string,
  label: string,
  category: MetricCategory,
  paths: string[][],
  options: Pick<TextMetricDefinition, "optional"> = {}
): TextMetricDefinition {
  return {
    key,
    label,
    category,
    paths,
    ...options
  };
}

function numberAt(summary: SummaryRecord, paths: string[][]): number | null {
  for (const path of paths) {
    const value = valueAt(summary, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function textAt(summary: SummaryRecord, paths: string[][]): string | null {
  const value = textOrNumberAt(summary, paths);
  return value === null ? null : String(value);
}

function textOrNumberAt(summary: SummaryRecord, paths: string[][]): string | number | null {
  for (const path of paths) {
    const value = valueAt(summary, path);
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    if (typeof value === "boolean") {
      return String(value);
    }
  }

  return null;
}

function valueAt(source: unknown, path: string[]): unknown {
  let current = source;
  for (const part of path) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function warningForMissing(
  label: string,
  aValue: number | string | boolean | null,
  bValue: number | string | boolean | null,
  optional = false
): string | undefined {
  if (aValue !== null && bValue !== null) {
    return undefined;
  }

  const side = aValue === null && bValue === null ? "both runs" : aValue === null ? "run A" : "run B";
  return `${optional ? "Optional metric" : "Metric"} unavailable for ${side}: ${label}`;
}

function isRecord(value: unknown): value is SummaryRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : value;
}

function categoryTitle(category: MetricCategory): string {
  switch (category) {
    case "runHealth":
      return "Run Health";
    case "outcomes":
      return "Outcomes";
    case "bidding":
      return "Bidding";
    case "makerDefender":
      return "Maker / Defender";
    case "loner":
      return "Loner";
    case "seatDealer":
      return "Seat / Dealer";
    case "metadata":
      return "Metadata";
    default:
      category satisfies never;
      return "Metrics";
  }
}

function formatIdentity(identity: PlaytestComparisonRunIdentity): string {
  return [
    identity.label,
    identity.botPolicy,
    identity.games === null || identity.games === undefined ? null : `${identity.games} games`,
    identity.seed === null || identity.seed === undefined ? null : `seed ${identity.seed}`,
    identity.invariants
  ].filter(Boolean).join(" | ");
}

function formatTable(metrics: MetricComparison[]): string {
  const header = [
    pad("Metric", 34),
    pad("A", 18),
    pad("B", 18),
    "Delta"
  ].join("");
  const rows = metrics.map((item) => [
    pad(item.label, 34),
    pad(formatValue(item.a, item.unit), 18),
    pad(formatValue(item.b, item.unit), 18),
    formatDelta(item.delta, item.unit)
  ].join(""));

  return [header, ...rows].join("\n");
}

function formatValue(value: number | string | boolean | null, unit: MetricComparison["unit"]): string {
  if (value === null) {
    return "n/a";
  }
  if (typeof value !== "number") {
    return String(value);
  }
  if (unit === "percentagePoints") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (unit === "milliseconds") {
    return `${Math.round(value)}ms`;
  }
  if (unit === "count" || unit === "hands") {
    return String(Math.round(value));
  }

  return String(value);
}

function formatDelta(delta: number | null | undefined, unit: MetricComparison["unit"]): string {
  if (delta === null || delta === undefined) {
    return "n/a";
  }

  const sign = delta > 0 ? "+" : "";
  if (unit === "percentagePoints") {
    return `${sign}${(delta * 100).toFixed(1)} pts`;
  }
  if (unit === "milliseconds") {
    return `${sign}${Math.round(delta)}ms`;
  }
  if (unit === "count" || unit === "hands") {
    return `${sign}${Math.round(delta)}`;
  }

  return `${sign}${delta}`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? `${value.slice(0, width - 1)} ` : value.padEnd(width, " ");
}
