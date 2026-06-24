import { describe, expect, it } from "vitest";
import {
  FARMERS_HAND_QUALIFIER_TEXT,
  buildRuleSummary,
  firstSeedFromEvents,
  formatSeed,
  parsePracticeSeed
} from "./rule-summary";

describe("house rule summary", () => {
  it("builds labels from full config", () => {
    const summary = buildRuleSummary({
      stickDealer: true,
      targetScore: 15,
      botDifficulty: "strong",
      dealerSelection: "seat2",
      farmersHandMode: "replaceThree",
      lonerMode: "withPartnerAllowed"
    }, {
      seed: 12345,
      initialDealer: 2
    });

    expect(summary.targetScoreLabel).toBe("15");
    expect(summary.botDifficultyLabel).toBe("Strong");
    expect(summary.dealerSelectionLabel).toBe("Seat 2");
    expect(summary.initialDealerLabel).toBe("Seat 2");
    expect(summary.stickDealerLabel).toBe("On");
    expect(summary.farmersHandModeLabel).toBe("Replace three");
    expect(summary.farmersHandQualifierText).toBe(FARMERS_HAND_QUALIFIER_TEXT);
    expect(summary.lonerModeLabel).toBe("Assisted variant (deferred)");
    expect(summary.seedLabel).toBe("12345");
    expect(summary.warnings).toHaveLength(1);
  });

  it("normalizes missing config fields to defaults", () => {
    const summary = buildRuleSummary({ stickDealer: false });

    expect(summary.config.targetScore).toBe(10);
    expect(summary.config.botDifficulty).toBe("standard");
    expect(summary.config.dealerSelection).toBe("default");
    expect(summary.config.farmersHandMode).toBe("off");
    expect(summary.config.lonerMode).toBe("aloneOnly");
    expect(summary.defaultsApplied).toBe(true);
    expect(summary.seedLabel).toBe("Not recorded");
  });

  it("extracts seed from the first start-hand event", () => {
    const events = [
      { eventType: "START_HAND" as const, payload: { type: "START_HAND" as const, seed: 24680 } },
      { eventType: "NEXT_HAND" as const, payload: { type: "NEXT_HAND" as const, seed: 13579 } }
    ];

    expect(firstSeedFromEvents(events)).toBe(24680);
    expect(buildRuleSummary({}, { events }).seedLabel).toBe("24680");
  });

  it("parses, trims, normalizes, and falls back for practice seeds", () => {
    expect(parsePracticeSeed(" 42 ", 999)).toEqual({ seed: 42, source: "input" });
    expect(parsePracticeSeed("-12", 999)).toEqual({ seed: 12, source: "input" });
    expect(parsePracticeSeed("not-a-number", 999)).toEqual({ seed: 999, source: "generated" });
    expect(formatSeed(undefined)).toBe("Not recorded");
  });
});
