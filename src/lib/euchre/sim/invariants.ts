import { cardId, createDeck, effectiveSuit } from "../cards";
import { nextPlayer } from "../deck";
import { determineTrickWinner, scoreHand } from "../rules";
import {
  RANKS,
  SUITS,
  type Card,
  type GameAction,
  type GameState,
  type Phase,
  type PlayerIndex,
  type Trick
} from "../types";

export type InvariantSeverity = "error" | "warning";

export type InvariantViolation = {
  code: string;
  severity: InvariantSeverity;
  message: string;
  context?: Record<string, unknown>;
};

export type InvariantCheckContext = {
  gameIndex?: number;
  handNumber?: number;
  phase?: string;
  lastAction?: GameAction | unknown;
  previousScores?: [number, number];
  strict?: boolean;
};

const VALID_PHASES: Phase[] = [
  "idle",
  "farmersHand",
  "ordering",
  "discarding",
  "calling",
  "playing",
  "handComplete",
  "gameComplete"
];
const VALID_SEATS: PlayerIndex[] = [0, 1, 2, 3];
const FULL_DECK_IDS = new Set(createDeck().map(cardId));

type CardZone = {
  card: Card;
  zone: string;
};

export function checkGameInvariants(
  state: GameState,
  context: InvariantCheckContext = {}
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const phase = String(context.phase ?? state.phase);

  const add = (
    code: string,
    severity: InvariantSeverity,
    message: string,
    extraContext: Record<string, unknown> = {}
  ) => {
    violations.push({
      code,
      severity,
      message,
      context: {
        gameIndex: context.gameIndex,
        handNumber: context.handNumber ?? state.handNumber,
        phase,
        ...extraContext
      }
    });
  };

  if (!VALID_PHASES.includes(state.phase)) {
    add("invalid-phase", "error", `Unknown game phase: ${String(state.phase)}`, { phase: state.phase });
    return violations;
  }

  if (!isSeat(state.dealer)) {
    add("invalid-dealer", "error", `Invalid dealer seat: ${String(state.dealer)}`, { dealer: state.dealer });
  }
  if (!isSeat(state.activePlayer)) {
    add("invalid-active-player", "error", `Invalid active player: ${String(state.activePlayer)}`, { activePlayer: state.activePlayer });
  }
  if (!Number.isInteger(state.config.targetScore) || state.config.targetScore <= 0) {
    add("invalid-target-score", "error", "Target score must be a positive integer", { targetScore: state.config.targetScore });
  }

  checkScores(state, context, add);
  checkMoveLog(state, add);
  checkPhaseContext(state, add);
  checkCards(state, add);
  checkTricks(state, add);
  checkScoring(state, add);

  if (state.lonePlayer !== undefined) {
    add(
      "lone-sitout-not-modeled",
      "warning",
      "Lone calls are scored, but partner sit-out trick shape is not modeled yet; current engine still plays four-card tricks.",
      { lonePlayer: state.lonePlayer, lonerMode: state.config.lonerMode }
    );
  }

  return violations;
}

function checkScores(
  state: GameState,
  context: InvariantCheckContext,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  state.scores.forEach((score, team) => {
    if (!Number.isInteger(score) || score < 0) {
      add("invalid-score", "error", "Team scores must be non-negative integers", { team, score });
    }
    const previous = context.previousScores?.[team as 0 | 1];
    if (previous !== undefined && score < previous) {
      add("score-decreased", "error", "Team score decreased after an action", { team, previous, score });
    }
  });

  const winningTeams = state.scores.filter((score) => score >= state.config.targetScore).length;
  if (state.phase === "gameComplete" && winningTeams === 0) {
    add("invalid-terminal-score", "error", "A completed game must have a team at or above the target score", {
      scores: state.scores,
      targetScore: state.config.targetScore
    });
  }
  if (state.phase !== "gameComplete" && winningTeams > 0) {
    add("target-score-not-terminal", "error", "A game at or above the target score should be terminal", {
      scores: state.scores,
      targetScore: state.config.targetScore
    });
  }
}

function checkMoveLog(
  state: GameState,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  const seen = new Set<number>();
  state.moveLog.forEach((event, index) => {
    if (event.sequence !== index) {
      add("invalid-move-sequence", "error", "Move log sequence does not match append order", {
        index,
        sequence: event.sequence
      });
    }
    if (seen.has(event.sequence)) {
      add("duplicate-move-sequence", "error", "Move log contains a duplicate sequence number", {
        sequence: event.sequence
      });
    }
    seen.add(event.sequence);
  });
}

function checkPhaseContext(
  state: GameState,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  if (state.phase === "idle") {
    if (state.handNumber !== 0) {
      add("invalid-phase-context", "error", "Idle games should not have started hands", { handNumber: state.handNumber });
    }
    return;
  }

  if (state.handNumber < 1) {
    add("invalid-phase-context", "error", "Non-idle games must have a positive hand number", { handNumber: state.handNumber });
  }

  if ((state.phase === "ordering" || state.phase === "discarding") && !state.upcard) {
    add("missing-upcard", "error", "Ordering and dealer pickup phases require an upcard");
  }
  if (state.phase === "ordering" && state.trump) {
    add("invalid-bidding-context", "error", "Trump should not be set during round-one ordering", { trump: state.trump });
  }
  if (state.phase === "calling" && !state.turnedDownSuit) {
    add("invalid-bidding-context", "error", "Round-two calling requires a turned-down suit");
  }
  if (state.phase === "discarding") {
    if (state.activePlayer !== state.dealer) {
      add("invalid-active-player", "error", "Dealer must be active during pickup/discard", {
        dealer: state.dealer,
        activePlayer: state.activePlayer
      });
    }
    if (!state.trump || state.maker === undefined || state.makerTeam === undefined) {
      add("invalid-pickup-context", "error", "Discarding phase requires trump and maker context", {
        trump: state.trump,
        maker: state.maker,
        makerTeam: state.makerTeam
      });
    }
  }
  if (state.phase === "playing") {
    if (!state.trump) {
      add("missing-trump-in-play", "error", "Play phase requires trump");
    }
    if (!state.currentTrick) {
      add("missing-current-trick", "error", "Play phase requires a current trick");
    }
  }
}

function checkCards(
  state: GameState,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  const handZones = VALID_SEATS.flatMap((seat) => state.hands[seat].map((card) => ({ card, zone: `hand-${seat}` })));
  const kittyZones = state.kitty.map((card) => ({ card, zone: "kitty" }));
  const currentTrickZones = state.currentTrick?.plays.map((play) => ({ card: play.card, zone: "current-trick" })) ?? [];
  const completedTrickZones = state.completedTricks.flatMap((trick, trickIndex) =>
    trick.plays.map((play) => ({ card: play.card, zone: `completed-trick-${trickIndex + 1}` }))
  );
  const allKnownZones = [...handZones, ...kittyZones, ...currentTrickZones, ...completedTrickZones];
  const physicalPlayZones = [...handZones, ...currentTrickZones, ...completedTrickZones];

  for (const zone of allKnownZones) {
    if (!isValidCard(zone.card)) {
      add("invalid-card-zone", "error", "Card zone contains an invalid Euchre card", {
        zone: zone.zone,
        card: zone.card
      });
    }
  }

  checkDuplicateCards(physicalPlayZones, add);
  checkHandSizes(state, handZones.length, add);

  const hasDealerPickup = state.bids.some((bid) => bid.round === 1 && bid.decision === "order-up");
  const shouldHaveFullKnownDeck =
    state.phase === "ordering" ||
    state.phase === "calling" ||
    state.phase === "farmersHand" ||
    (!hasDealerPickup && state.phase !== "idle");

  if (shouldHaveFullKnownDeck) {
    checkFullDeckCoverage(allKnownZones, add);
  } else if (hasDealerPickup && (state.phase === "playing" || state.phase === "handComplete" || state.phase === "gameComplete")) {
    add(
      "discard-card-not-retained",
      "warning",
      "Dealer pickup hands cannot be fully card-conserved from state alone because the discarded card is only represented in the move event.",
      { handNumber: state.handNumber }
    );
  }
}

function checkDuplicateCards(
  zones: CardZone[],
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  const seen = new Map<string, string>();
  for (const zone of zones) {
    if (!isValidCard(zone.card)) {
      continue;
    }
    const id = cardId(zone.card);
    const existing = seen.get(id);
    if (existing) {
      add("duplicate-card", "error", "A card appears in more than one live play zone", {
        card: id,
        firstZone: existing,
        secondZone: zone.zone
      });
    }
    seen.set(id, zone.zone);
  }
}

function checkFullDeckCoverage(
  zones: CardZone[],
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  const ids = zones.filter((zone) => isValidCard(zone.card)).map((zone) => cardId(zone.card));
  const unique = new Set(ids);

  if (ids.length !== 24 || unique.size !== 24) {
    add("invalid-card-zone", "error", "Known card zones should contain exactly one full 24-card Euchre deck", {
      totalCards: ids.length,
      uniqueCards: unique.size
    });
    return;
  }

  for (const id of unique) {
    if (!FULL_DECK_IDS.has(id)) {
      add("invalid-card-zone", "error", "Known card zones contain a card outside the Euchre deck", { card: id });
    }
  }
}

function checkHandSizes(
  state: GameState,
  totalHandCards: number,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  const sizes = VALID_SEATS.map((seat) => state.hands[seat].length);
  const invalidSeat = sizes.findIndex((size) => size < 0 || size > 6);
  if (invalidSeat !== -1) {
    add("invalid-hand-size", "error", "Player hand size is outside plausible Euchre bounds", {
      seat: invalidSeat,
      size: sizes[invalidSeat]
    });
  }

  if (state.phase === "idle" && totalHandCards !== 0) {
    add("invalid-hand-size", "error", "Idle game should not have cards in player hands", { sizes });
  }
  if ((state.phase === "ordering" || state.phase === "calling" || state.phase === "farmersHand") && sizes.some((size) => size !== 5)) {
    add("invalid-hand-size", "error", "Bidding phases require five cards per player", { sizes });
  }
  if (state.phase === "discarding") {
    const dealerSize = state.hands[state.dealer].length;
    const otherSizesValid = VALID_SEATS.filter((seat) => seat !== state.dealer).every((seat) => state.hands[seat].length === 5);
    if (dealerSize !== 6 || !otherSizesValid) {
      add("invalid-hand-size", "error", "Dealer pickup phase requires dealer to hold six cards and others five", {
        dealer: state.dealer,
        sizes
      });
    }
  }
  if (state.phase === "playing") {
    const playZoneCount = totalHandCards + (state.currentTrick?.plays.length ?? 0) + state.completedTricks.reduce((sum, trick) => sum + trick.plays.length, 0);
    if (playZoneCount !== 20) {
      add("invalid-card-zone", "error", "Playing hand should account for 20 dealt play cards", {
        playZoneCount,
        sizes
      });
    }
  }
  if ((state.phase === "handComplete" || state.phase === "gameComplete") && state.handResult && sizes.some((size) => size !== 0)) {
    add("invalid-hand-size", "error", "Completed played hands should leave no cards in player hands", { sizes });
  }
  if ((state.phase === "handComplete" || state.phase === "gameComplete") && !state.handResult && sizes.some((size) => size !== 5)) {
    add("invalid-hand-size", "error", "Passed-out hands should retain five cards per player", { sizes });
  }
}

function checkTricks(
  state: GameState,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  if (state.completedTricks.length > 5) {
    add("invalid-trick-card-count", "error", "A hand cannot contain more than five completed tricks", {
      completedTricks: state.completedTricks.length
    });
  }

  if (state.currentTrick) {
    checkTrickSeatsAndOrder(state.currentTrick, false, add);
    if (state.currentTrick.plays.length > 4) {
      add("invalid-trick-card-count", "error", "Current trick cannot contain more than four plays", {
        plays: state.currentTrick.plays.length
      });
    }
  }

  state.completedTricks.forEach((trick, index) => {
    checkTrickSeatsAndOrder(trick, true, add, index + 1);
    if (trick.plays.length !== 4) {
      add("invalid-trick-card-count", "error", "Completed tricks must contain four cards in the current engine", {
        trickNumber: index + 1,
        plays: trick.plays.length
      });
    }
    if (trick.winner === undefined || !isSeat(trick.winner)) {
      add("missing-trick-winner", "error", "Completed trick is missing a valid winner", {
        trickNumber: index + 1,
        winner: trick.winner
      });
    }
    if (state.trump && trick.plays.length === 4 && trick.winner !== undefined) {
      const expectedWinner = determineTrickWinner(trick, state.trump);
      if (expectedWinner !== trick.winner) {
        add("invalid-trick-winner", "error", "Stored trick winner does not match rule engine result", {
          trickNumber: index + 1,
          expectedWinner,
          winner: trick.winner
        });
      }
      const ledSuit = effectiveSuit(trick.plays[0].card, state.trump);
      if (!SUITS.includes(ledSuit)) {
        add("invalid-trick-led-suit", "error", "Completed trick has an invalid led suit", { trickNumber: index + 1 });
      }
    }
  });

  if (state.handResult && state.completedTricks.length !== 5) {
    add("invalid-completed-hand", "error", "Scored hands must contain exactly five completed tricks", {
      completedTricks: state.completedTricks.length
    });
  }
}

function checkTrickSeatsAndOrder(
  trick: Trick,
  completed: boolean,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void,
  trickNumber?: number
) {
  if (!isSeat(trick.leader)) {
    add("invalid-active-player", "error", "Trick leader must be a valid seat", { trickNumber, leader: trick.leader });
  }

  const seenPlayers = new Set<PlayerIndex>();
  trick.plays.forEach((play, index) => {
    if (!isSeat(play.player)) {
      add("invalid-active-player", "error", "Trick play has an invalid player", { trickNumber, player: play.player });
      return;
    }
    if (seenPlayers.has(play.player)) {
      add("duplicate-trick-seat", "error", "A player appears twice in one trick", { trickNumber, player: play.player });
    }
    seenPlayers.add(play.player);

    const expected = playerAtTrickOffset(trick.leader, index);
    if (play.player !== expected) {
      add("invalid-trick-play-order", "error", "Trick play order does not follow clockwise order from leader", {
        trickNumber,
        index,
        expected,
        player: play.player,
        completed
      });
    }
  });
}

function checkScoring(
  state: GameState,
  add: (code: string, severity: InvariantSeverity, message: string, context?: Record<string, unknown>) => void
) {
  if (!state.handResult) {
    return;
  }

  const points = state.handResult.pointsAwarded[0] + state.handResult.pointsAwarded[1];
  if (![1, 2, 4].includes(points)) {
    add("invalid-hand-score", "error", "Scored hand awarded an impossible number of points", {
      pointsAwarded: state.handResult.pointsAwarded
    });
  }
  if (state.handResult.tricksWon[0] + state.handResult.tricksWon[1] !== 5) {
    add("invalid-hand-score", "error", "Scored hand trick totals must add to five", {
      tricksWon: state.handResult.tricksWon
    });
  }

  if (state.trump && state.maker !== undefined && state.makerTeam !== undefined) {
    const expected = scoreHand({
      maker: state.maker,
      makerTeam: state.makerTeam,
      trump: state.trump,
      tricksWon: state.tricksWon,
      lonePlayer: state.lonePlayer
    });
    if (
      expected.euchred !== state.handResult.euchred ||
      expected.march !== state.handResult.march ||
      expected.lone !== state.handResult.lone ||
      expected.pointsAwarded[0] !== state.handResult.pointsAwarded[0] ||
      expected.pointsAwarded[1] !== state.handResult.pointsAwarded[1]
    ) {
      add("invalid-hand-score", "error", "Stored hand result does not match scoring rules", {
        expected,
        actual: state.handResult
      });
    }
  }
}

function playerAtTrickOffset(leader: PlayerIndex, offset: number): PlayerIndex {
  let player = leader;
  for (let index = 0; index < offset; index += 1) {
    player = nextPlayer(player);
  }
  return player;
}

function isSeat(value: unknown): value is PlayerIndex {
  return Number.isInteger(value) && VALID_SEATS.includes(value as PlayerIndex);
}

function isValidCard(card: Card): card is Card {
  return Boolean(
    card &&
    typeof card === "object" &&
    SUITS.includes(card.suit) &&
    RANKS.includes(card.rank)
  );
}

export function invariantErrorCodes(violations: InvariantViolation[]): string[] {
  return violations.filter((violation) => violation.severity === "error").map((violation) => violation.code);
}

export function invariantWarningCodes(violations: InvariantViolation[]): string[] {
  return violations.filter((violation) => violation.severity === "warning").map((violation) => violation.code);
}
