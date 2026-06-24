import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  comparePlaytestRuns,
  formatPlaytestComparisonReport
} from "./playtest-comparison";

describe("playtest comparison", () => {
  it("compares two minimal valid summaries", () => {
    const report = comparePlaytestRuns(
      { label: "basic", summary: minimalSummary({ botPolicy: "basic-v1", completedGames: 10 }) },
      { label: "random", summary: minimalSummary({ botPolicy: "legal-random-v1", completedGames: 10 }) }
    );

    expect(report.a.label).toBe("basic");
    expect(report.b.label).toBe("random");
    expect(report.a.botPolicy).toBe("basic-v1");
    expect(report.b.botPolicy).toBe("legal-random-v1");
    expect(metric(report, "completedGames")?.a).toBe(10);
  });

  it("computes count deltas correctly", () => {
    const report = comparePlaytestRuns(
      { label: "a", summary: minimalSummary({ totalHands: 100, loneAttemptCount: 20 }) },
      { label: "b", summary: minimalSummary({ totalHands: 125, loneAttemptCount: 8 }) }
    );

    expect(metric(report, "totalHands")?.delta).toBe(25);
    expect(metric(report, "loneAttemptCount")?.delta).toBe(-12);
  });

  it("computes rate deltas as percentage points", () => {
    const report = comparePlaytestRuns(
      { label: "a", summary: minimalSummary({ makerWinRate: 0.7, team0WinRate: 0.5 }) },
      { label: "b", summary: minimalSummary({ makerWinRate: 0.45, team0WinRate: 0.55 }) }
    );

    expect(metric(report, "makerWinRate")?.delta).toBeCloseTo(-0.25);
    expect(metric(report, "team0WinRate")?.delta).toBeCloseTo(0.05);
    expect(formatPlaytestComparisonReport(report)).toContain("-25.0 pts");
  });

  it("handles missing optional metrics with warnings", () => {
    const report = comparePlaytestRuns(
      { label: "a", summary: { totalGames: 1, completedGames: 1, failedGames: 0, totalHands: 10 } },
      { label: "b", summary: minimalSummary({}) }
    );

    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some((warning) => warning.includes("Optional metric unavailable"))).toBe(true);
  });

  it("includes identity fields", () => {
    const report = comparePlaytestRuns(
      { label: "a", summary: minimalSummary({ seed: "abc", invariants: "warn", targetScore: 15, stickDealer: false }) },
      { label: "b", summary: minimalSummary({ seed: "abc", invariants: "strict", targetScore: 10, stickDealer: true }) }
    );

    expect(report.a.seed).toBe("abc");
    expect(report.a.invariants).toBe("warn");
    expect(metric(report, "targetScore")?.a).toBe("15");
    expect(metric(report, "stickDealer")?.b).toBe("true");
  });

  it("rejects invalid summaries clearly", () => {
    expect(() => comparePlaytestRuns(
      { label: "a", summary: { notAPlaytest: true } },
      { label: "b", summary: minimalSummary({}) }
    )).toThrow("Invalid playtest summary for a");
  });

  it("works with clean 1k summary files when local artifacts exist", () => {
    const basicPath = path.join(process.cwd(), "playtest-results", "basic-v1-clean-1k", "summary.json");
    const randomPath = path.join(process.cwd(), "playtest-results", "legal-random-v1-clean-1k", "summary.json");
    if (!existsSync(basicPath) || !existsSync(randomPath)) {
      return;
    }

    const report = comparePlaytestRuns(
      { label: "basic-v1", summary: JSON.parse(readFileSync(basicPath, "utf8")) },
      { label: "legal-random-v1", summary: JSON.parse(readFileSync(randomPath, "utf8")) }
    );

    expect(report.a.botPolicy).toBe("basic-v1");
    expect(report.b.botPolicy).toBe("legal-random-v1");
    expect(metric(report, "makerWinRate")?.delta).not.toBeNull();
  });

  it("CLI missing args show usage and exit non-zero", () => {
    const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "compare-playtests.cjs")], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Usage:");
  });
});

type MinimalOptions = {
  botPolicy?: string;
  completedGames?: number;
  totalHands?: number;
  loneAttemptCount?: number;
  makerWinRate?: number;
  team0WinRate?: number;
  seed?: string | number;
  invariants?: string;
  targetScore?: number;
  stickDealer?: boolean;
};

function minimalSummary(options: MinimalOptions) {
  const team0WinRate = options.team0WinRate ?? 0.5;
  const makerWinRate = options.makerWinRate ?? 0.7;

  return {
    config: {
      games: options.completedGames ?? 10,
      seed: options.seed ?? 12345,
      targetScore: options.targetScore ?? 10,
      stickDealer: options.stickDealer ?? true,
      invariants: options.invariants ?? "strict",
      botPolicy: options.botPolicy ?? "basic-v1"
    },
    totalGames: options.completedGames ?? 10,
    completedGames: options.completedGames ?? 10,
    failedGames: 0,
    totalHands: options.totalHands ?? 100,
    elapsedMs: 1000,
    botPolicy: {
      id: options.botPolicy ?? "basic-v1",
      version: "1.0.0"
    },
    comparison: {
      botPolicy: options.botPolicy ?? "basic-v1",
      botPolicyVersion: "1.0.0",
      games: options.completedGames ?? 10,
      completedGames: options.completedGames ?? 10,
      failedGames: 0,
      averageHandsPerGame: 10,
      teamWinRates: {
        northSouth: team0WinRate,
        eastWest: 1 - team0WinRate
      },
      makerWinRate,
      euchreRate: 1 - makerWinRate,
      marchRate: 0.12,
      loneAttemptRate: 0.1,
      loneSuccessRate: 0.25,
      roundOneCallRate: 0.8,
      roundTwoCallRate: 0.2,
      stickDealerRate: 0.01,
      blowoutRate: 0.2,
      closeGameRate: 0.3
    },
    metrics: {
      totalGames: options.completedGames ?? 10,
      completedGames: options.completedGames ?? 10,
      failedGames: 0,
      totalHands: options.totalHands ?? 100,
      elapsedMs: 1000,
      averageHandsPerGame: 10,
      dealerPickupRate: 0.8,
      passoutRate: 0,
      makerWinRate,
      makerEuchreRate: 1 - makerWinRate,
      makerMarchRate: 0.12,
      averageMakerTricks: 3.1,
      averageDefenderTricks: 1.9,
      defenderEuchreRate: 1 - makerWinRate,
      loneAttemptCount: options.loneAttemptCount ?? 10,
      loneSuccessCount: 2,
      loneAttemptRate: 0.1,
      loneSuccessRate: 0.2,
      loneEuchreCount: 1,
      makerSuccessRateBySeat: { 0: makerWinRate, 1: makerWinRate, 2: makerWinRate, 3: makerWinRate },
      euchreRateByMakerSeat: { 0: 1 - makerWinRate, 1: 1 - makerWinRate, 2: 1 - makerWinRate, 3: 1 - makerWinRate },
      handWinRateByDealerSeat: { 0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5 },
      callerSeatDistribution: { 0: 25, 1: 25, 2: 25, 3: 25 }
    }
  };
}

function metric(report: ReturnType<typeof comparePlaytestRuns>, key: string) {
  return report.metrics.find((item) => item.key === key);
}
