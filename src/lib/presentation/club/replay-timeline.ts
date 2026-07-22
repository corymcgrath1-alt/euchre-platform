import {
  applyMoveEvent,
  cardLabel,
  createInitialGameState,
  type GameConfig,
  type GameState,
  type PlayerIndex
} from "@/lib/euchre";
import {
  persistedEventToMoveEvent,
  type PersistedMoveEventRecord
} from "@/lib/persistence/event-store";
import { buildClubTableView, type ClubTableView } from "./table";

export type ClubReplayStepKind =
  | "deal"
  | "farmers-hand"
  | "bid"
  | "discard"
  | "card-play"
  | "trick-complete"
  | "hand-score"
  | "final-result";

export interface ClubReplayStep {
  readonly index: number;
  readonly kind: ClubReplayStepKind;
  readonly sequenceNumber: number;
  readonly label: string;
  readonly detail: string;
  readonly table: ClubTableView;
}

export interface ClubReplayTimeline {
  readonly gameId: string;
  readonly viewerSeat: PlayerIndex;
  readonly totalEvents: number;
  readonly steps: readonly ClubReplayStep[];
}

export interface BuildClubReplayTimelineInput {
  readonly gameId: string;
  readonly config: GameConfig;
  readonly events: readonly PersistedMoveEventRecord[];
  readonly viewerSeat: PlayerIndex;
}

export function buildClubReplayTimeline(input: BuildClubReplayTimelineInput): ClubReplayTimeline {
  const orderedEvents = [...input.events]
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
    .map(clonePersistedEvent);

  if (orderedEvents.length === 0) {
    return {
      gameId: input.gameId,
      viewerSeat: input.viewerSeat,
      totalEvents: 0,
      steps: []
    };
  }

  let state: GameState = {
    ...createInitialGameState(input.config),
    id: input.gameId
  };
  const steps: ClubReplayStep[] = [];

  for (const event of orderedEvents) {
    const before = state;
    state = applyMoveEvent(state, persistedEventToMoveEvent(event));
    appendStep(steps, primaryStep(event, state), state, input.viewerSeat);

    if (state.completedTricks.length > before.completedTricks.length) {
      const completed = state.completedTricks[state.completedTricks.length - 1];
      const winner = completed?.winner;
      appendStep(steps, {
        kind: "trick-complete",
        sequenceNumber: event.sequenceNumber,
        label: `Trick ${state.completedTricks.length} complete`,
        detail: winner === undefined ? "Trick winner unavailable" : `${playerLabel(winner)} won the trick`
      }, state, input.viewerSeat, true);
    }

    const handCompleted = !isCompletedPhase(before.phase) && isCompletedPhase(state.phase);
    if (handCompleted) {
      appendStep(steps, {
        kind: "hand-score",
        sequenceNumber: event.sequenceNumber,
        label: `Hand ${state.handNumber} scored`,
        detail: state.handResult
          ? `Team 0 +${state.handResult.pointsAwarded[0]}, Team 1 +${state.handResult.pointsAwarded[1]}`
          : "Hand passed out; score unchanged"
      }, state, input.viewerSeat);
    }

    if (before.phase !== "gameComplete" && state.phase === "gameComplete") {
      appendStep(steps, {
        kind: "final-result",
        sequenceNumber: event.sequenceNumber,
        label: "Game complete",
        detail: `Final score: Team 0 ${state.scores[0]}, Team 1 ${state.scores[1]}`
      }, state, input.viewerSeat);
    }
  }

  return {
    gameId: input.gameId,
    viewerSeat: input.viewerSeat,
    totalEvents: orderedEvents.length,
    steps
  };
}

export function selectClubReplayStep(timeline: ClubReplayTimeline, requestedIndex: number): ClubReplayStep | undefined {
  if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= timeline.steps.length) {
    return undefined;
  }

  return timeline.steps[requestedIndex];
}

function appendStep(
  steps: ClubReplayStep[],
  event: Omit<ClubReplayStep, "index" | "table">,
  state: GameState,
  viewerSeat: PlayerIndex,
  showLatestCompletedTrick = false
): void {
  steps.push({
    ...event,
    index: steps.length,
    table: buildClubTableView(state, viewerSeat, { showLatestCompletedTrick })
  });
}

function primaryStep(
  event: PersistedMoveEventRecord,
  state: GameState
): Omit<ClubReplayStep, "index" | "table"> {
  const action = event.payload;
  switch (action.type) {
    case "START_HAND":
    case "NEXT_HAND":
      return {
        kind: "deal",
        sequenceNumber: event.sequenceNumber,
        label: `Hand ${state.handNumber} dealt`,
        detail: `${playerLabel(state.dealer)} is dealer`
      };
    case "FARMERS_HAND_DECLINE":
      return {
        kind: "farmers-hand",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} declined Farmer's Hand`,
        detail: "No cards were revealed"
      };
    case "FARMERS_HAND_REDEAL":
      return {
        kind: "farmers-hand",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} claimed a redeal`,
        detail: "Replacement deal completed"
      };
    case "FARMERS_HAND_REPLACE":
      return {
        kind: "farmers-hand",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} replaced cards`,
        detail: `${action.cards.length} private card${action.cards.length === 1 ? "" : "s"} exchanged`
      };
    case "PASS":
      return {
        kind: "bid",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} passed`,
        detail: "Bidding continued"
      };
    case "ORDER_UP":
      return {
        kind: "bid",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} ordered up${action.alone ? " alone" : ""}`,
        detail: `Trump is ${state.trump ?? "not set"}`
      };
    case "CALL_TRUMP":
      return {
        kind: "bid",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} called ${action.suit}${action.alone ? " alone" : ""}`,
        detail: `Trump is ${action.suit}`
      };
    case "DISCARD":
      return {
        kind: "discard",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} discarded`,
        detail: "The discarded card remains private"
      };
    case "PLAY_CARD":
      return {
        kind: "card-play",
        sequenceNumber: event.sequenceNumber,
        label: `${playerLabel(action.player)} played ${cardLabel(action.card)}`,
        detail: "Card play accepted by the Platform engine"
      };
    case "RESET_GAME":
      throw new Error("Persisted replay cannot contain RESET_GAME");
  }
}

function clonePersistedEvent(event: PersistedMoveEventRecord): PersistedMoveEventRecord {
  return JSON.parse(JSON.stringify(event)) as PersistedMoveEventRecord;
}

function isCompletedPhase(phase: GameState["phase"]): boolean {
  return phase === "handComplete" || phase === "gameComplete";
}

function playerLabel(player: PlayerIndex): string {
  return ["South", "West", "North", "East"][player];
}
