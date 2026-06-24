import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBotPolicy } from "../bot-policies";
import { createInitialGameState } from "../engine";
import { buildPlaytestFailure } from "./failure-log";
import { runPlaytest } from "./playtest-runner";

describe("playtest runner", () => {
  it("completes 100 simulated games with strict invariants enabled", async () => {
    const summary = await runPlaytest({
      games: 100,
      seed: 12345,
      targetScore: 10,
      stickDealer: true,
      invariants: "strict"
    });

    expect(summary.totalGames).toBe(100);
    expect(summary.completedGames).toBe(100);
    expect(summary.failedGames).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(summary.totalHands).toBeGreaterThan(0);
    expect(summary.config.botPolicy).toBe("basic-v1");
    expect(summary.botPolicy.id).toBe("basic-v1");
    expect(summary.metrics.botPolicyId).toBe("basic-v1");
    expect(summary.comparison.botPolicy).toBe("basic-v1");
  });

  it("completes 100 legal-random games with strict invariants enabled", async () => {
    const summary = await runPlaytest({
      games: 100,
      seed: 12345,
      targetScore: 10,
      stickDealer: true,
      botPolicy: "legal-random-v1",
      invariants: "strict"
    });

    expect(summary.completedGames).toBe(100);
    expect(summary.failedGames).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(summary.botPolicy.id).toBe("legal-random-v1");
    expect(summary.metrics.botPolicyId).toBe("legal-random-v1");
  });

  it("completes 100 intermediate games with strict invariants enabled", async () => {
    const summary = await runPlaytest({
      games: 100,
      seed: 12345,
      targetScore: 10,
      stickDealer: true,
      botPolicy: "intermediate-v1",
      invariants: "strict"
    });

    expect(summary.completedGames).toBe(100);
    expect(summary.failedGames).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(summary.botPolicy.id).toBe("intermediate-v1");
    expect(summary.metrics.botPolicyId).toBe("intermediate-v1");
  });

  it("same seed and config produce the same summary-critical results", async () => {
    const config = {
      games: 20,
      seed: "repeatable",
      targetScore: 10,
      stickDealer: true,
      invariants: "strict" as const
    };
    const first = await runPlaytest(config);
    const second = await runPlaytest(config);

    expect(second.completedGames).toBe(first.completedGames);
    expect(second.failedGames).toBe(first.failedGames);
    expect(second.totalHands).toBe(first.totalHands);
    expect(second.metrics.teamWins).toEqual(first.metrics.teamWins);
    expect(second.metrics.finalScoreDistribution).toEqual(first.metrics.finalScoreDistribution);
    expect(second.metrics.trumpSuitDistribution).toEqual(first.metrics.trumpSuitDistribution);
  });

  it("failure records include reproducibility fields", () => {
    const state = createInitialGameState({ targetScore: 10, stickDealer: true });
    const failure = buildPlaytestFailure({
      gameIndex: 7,
      seed: "seed-a",
      gameSeed: 123456,
      botPolicy: "basic-v1",
      botPolicyMetadata: getBotPolicy("basic-v1").metadata,
      config: state.config,
      state,
      error: new Error("forced failure"),
      lastActionAttempted: { type: "START_HAND", seed: 1 },
      lastSuccessfulAction: { type: "RESET_GAME" }
    });

    expect(failure.seed).toBe("seed-a");
    expect(failure.botPolicy).toBe("basic-v1");
    expect(failure.botPolicyMetadata.name).toBe("Basic v1");
    expect(failure.gameIndex).toBe(7);
    expect(failure.gameSeed).toBe(123456);
    expect(failure.phase).toBe("idle");
    expect(failure.lastActionAttempted).toEqual({ type: "START_HAND", seed: 1 });
    expect(failure.reason).toBe("Error");
    expect(failure.errorMessage).toBe("forced failure");
  });

  it("keeps metric totals internally consistent", async () => {
    const summary = await runPlaytest({
      games: 25,
      seed: 222,
      targetScore: 10,
      stickDealer: false,
      invariants: "strict"
    });

    expect(summary.completedGames + summary.failedGames).toBe(summary.totalGames);
    expect(summary.totalHands).toBeGreaterThan(0);
    expect(summary.metrics.teamWins[0] + summary.metrics.teamWins[1]).toBe(summary.completedGames);
    expect(summary.metrics.completedGames + summary.metrics.failedGames).toBe(summary.metrics.totalGames);
    expect(summary.metrics.makerHandCount + summary.metrics.passoutCount).toBe(summary.metrics.totalHands);
    expect(summary.metrics.botPolicyVersion).toBe(summary.botPolicy.version);
  });

  it("same seed, config, and bot policy produce the same comparison-critical metrics", async () => {
    const config = {
      games: 25,
      seed: "policy-repeatable",
      targetScore: 10,
      stickDealer: true,
      botPolicy: "legal-random-v1" as const,
      invariants: "strict" as const
    };
    const first = await runPlaytest(config);
    const second = await runPlaytest(config);

    expect(second.comparison).toEqual(first.comparison);
    expect(second.metrics.teamWins).toEqual(first.metrics.teamWins);
    expect(second.metrics.finalScoreDistribution).toEqual(first.metrics.finalScoreDistribution);
    expect(second.metrics.trumpSuitDistribution).toEqual(first.metrics.trumpSuitDistribution);
  });

  it("stays free of persistence/database writes", () => {
    const runnerSource = readFileSync(path.join(process.cwd(), "src/lib/euchre/sim/playtest-runner.ts"), "utf-8");

    expect(runnerSource).not.toContain("persistence");
    expect(runnerSource).not.toContain("event-store");
    expect(runnerSource).not.toContain("Supabase");
  });
});
