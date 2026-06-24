import { describe, expect, it } from "vitest";
import { simulateEuchreGames, simulationReportToCsv } from "./simulator";

describe("headless Euchre simulator", () => {
  it("completes a small deterministic simulation without illegal moves", () => {
    const report = simulateEuchreGames({
      games: 25,
      seed: 12345,
      config: { targetScore: 5, stickDealer: true, botDifficulty: "standard" }
    });

    expect(report.metrics.totalGames).toBe(25);
    expect(report.games).toHaveLength(25);
    expect(report.hands.length).toBeGreaterThan(25);
    expect(report.metrics.illegalMoveCount).toBe(0);
    expect(report.metrics.failedGames).toBe(0);
    expect(report.metrics.teamWins[0] + report.metrics.teamWins[1]).toBe(25);
  });

  it("same seed and config produce identical aggregate output", () => {
    const first = simulateEuchreGames({ games: 10, seed: 77, config: { targetScore: 5, stickDealer: false } });
    const second = simulateEuchreGames({ games: 10, seed: 77, config: { targetScore: 5, stickDealer: false } });

    expect(first.metrics).toEqual(second.metrics);
    expect(first.games).toEqual(second.games);
    expect(first.hands).toEqual(second.hands);
  });

  it("different seeds produce different paths", () => {
    const first = simulateEuchreGames({ games: 10, seed: 77, config: { targetScore: 5 } });
    const second = simulateEuchreGames({ games: 10, seed: 78, config: { targetScore: 5 } });

    expect(first.hands.map((hand) => `${hand.upcard}:${hand.trump}:${hand.pointsAwarded.join("-")}`)).not.toEqual(
      second.hands.map((hand) => `${hand.upcard}:${hand.trump}:${hand.pointsAwarded.join("-")}`)
    );
  });

  it("keeps hand score distribution consistent with total hands", () => {
    const report = simulateEuchreGames({ games: 12, seed: 99, config: { targetScore: 5 } });
    const distribution = report.metrics.handScoreDistribution;
    const total = distribution.onePoint + distribution.twoPointMarch + distribution.fourPointLoner + distribution.twoPointEuchre + distribution.passout;

    expect(total).toBe(report.metrics.totalHands);
    expect(report.metrics.botDecisionCounts.cardPlays).toBeGreaterThan(0);
  });

  it("writes practical CSV hand-level output", () => {
    const report = simulateEuchreGames({ games: 2, seed: 22, config: { targetScore: 5 } });
    const csv = simulationReportToCsv(report);

    expect(csv.split("\n")[0]).toContain("gameIndex,handNumber,dealer");
    expect(csv.split("\n").length).toBe(report.hands.length + 1);
  });
});
