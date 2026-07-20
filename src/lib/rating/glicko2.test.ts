import { describe, expect, it } from "vitest";
import {
  GLICKO2_ALGORITHM_VERSION,
  createRatingAccount,
  estimateTeamStrength,
  rateTeamMatch,
  type RatingLedgerEntry,
  type TeamRating
} from "./glicko2";

const queue = "solo-queue" as const;
const timestamp = "2026-07-20T00:00:00.000Z";

describe("Glicko-2 team rating foundation", () => {
  it("estimates team strength from both players", () => {
    const team = makeTeam("north-south", [
      createRatingAccount("south", queue, { rating: 1600, deviation: 80, volatility: 0.05 }),
      createRatingAccount("north", queue, { rating: 1400, deviation: 120, volatility: 0.07 })
    ]);

    expect(estimateTeamStrength(team)).toEqual({
      teamId: "north-south",
      rating: 1500,
      deviation: 72.11,
      volatility: 0.06
    });
  });

  it("moves winners up and losers down without using style or trick stats", () => {
    const entries = rateTeamMatch(equalMatch());

    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => entry.algorithmVersion === GLICKO2_ALGORITHM_VERSION)).toBe(true);
    expect(entries.filter((entry) => entry.result === 1).every((entry) => entry.ratingAfter > entry.ratingBefore)).toBe(true);
    expect(entries.filter((entry) => entry.result === 0).every((entry) => entry.ratingAfter < entry.ratingBefore)).toBe(true);
  });

  it("is symmetric for equal teams", () => {
    const entries = rateTeamMatch(equalMatch());
    const winnerDelta = entries.find((entry) => entry.playerId === "south")!.ratingAfter - 1500;
    const partnerDelta = entries.find((entry) => entry.playerId === "north")!.ratingAfter - 1500;
    const loserDelta = entries.find((entry) => entry.playerId === "west")!.ratingAfter - 1500;

    expect(winnerDelta).toBeCloseTo(partnerDelta, 4);
    expect(winnerDelta).toBeCloseTo(-loserDelta, 2);
  });

  it("changes uncertain accounts more than confident accounts", () => {
    const entries = rateTeamMatch({
      ...equalMatch(),
      teams: [
        makeTeam("north-south", [
          createRatingAccount("south", queue, { rating: 1500, deviation: 300 }),
          createRatingAccount("north", queue, { rating: 1500, deviation: 60 })
        ]),
        makeTeam("east-west", [
          createRatingAccount("west", queue, { rating: 1500, deviation: 60 }),
          createRatingAccount("east", queue, { rating: 1500, deviation: 60 })
        ])
      ]
    });

    const uncertainGain = entries.find((entry) => entry.playerId === "south")!.ratingAfter - 1500;
    const confidentGain = entries.find((entry) => entry.playerId === "north")!.ratingAfter - 1500;

    expect(uncertainGain).toBeGreaterThan(confidentGain);
  });

  it("does not emit a second update for the same idempotency key", () => {
    const first = rateTeamMatch(equalMatch());
    const second = rateTeamMatch({ ...equalMatch(), existingLedger: first });

    expect(second).toEqual([]);
  });

  it("does not silently update a player twice for the same match", () => {
    const first = rateTeamMatch(equalMatch());
    const partialExisting: RatingLedgerEntry[] = [first[0]];
    const next = rateTeamMatch({
      ...equalMatch(),
      idempotencyKey: "retry-with-new-key",
      existingLedger: partialExisting
    });

    expect(next.map((entry) => entry.playerId)).not.toContain(first[0].playerId);
    expect(next).toHaveLength(3);
  });

  it("keeps equal-certainty team updates rating-conservative", () => {
    const entries = rateTeamMatch(equalMatch());
    const totalDelta = entries.reduce((sum, entry) => sum + entry.ratingAfter - entry.ratingBefore, 0);

    expect(Math.abs(totalDelta)).toBeLessThan(0.01);
  });

  it("rejects invalid queue and duplicate-player inputs", () => {
    expect(() => rateTeamMatch({
      ...equalMatch(),
      teams: [
        makeTeam("north-south", [
          createRatingAccount("south", queue),
          createRatingAccount("south", queue)
        ]),
        equalMatch().teams[1]
      ]
    })).toThrow(/more than once/);

    expect(() => rateTeamMatch({
      ...equalMatch(),
      teams: [
        makeTeam("north-south", [
          createRatingAccount("south", "fixed-partners"),
          createRatingAccount("north", queue)
        ]),
        equalMatch().teams[1]
      ]
    })).toThrow(/match queue/);
  });
});

function equalMatch() {
  return {
    matchId: "match-1",
    queue,
    teams: [
      makeTeam("north-south", [
        createRatingAccount("south", queue, { rating: 1500, deviation: 100 }),
        createRatingAccount("north", queue, { rating: 1500, deviation: 100 })
      ]),
      makeTeam("east-west", [
        createRatingAccount("west", queue, { rating: 1500, deviation: 100 }),
        createRatingAccount("east", queue, { rating: 1500, deviation: 100 })
      ])
    ] as [TeamRating, TeamRating],
    winningTeamId: "north-south",
    timestamp,
    idempotencyKey: "match-1-final"
  };
}

function makeTeam(teamId: string, players: TeamRating["players"]): TeamRating {
  return { teamId, players };
}
