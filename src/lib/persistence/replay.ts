import { createInitialGameState, replayMoveLog, type GameAction, type GameConfig, type MoveEvent, type PlayerIndex } from "@/lib/euchre";
import type { PersistedMoveEventRecord } from "./types";

export function persistedEventToMoveEvent(event: PersistedMoveEventRecord): MoveEvent {
  return {
    id: event.id,
    sequence: event.sequenceNumber,
    action: event.payload,
    player: event.player,
    createdAt: event.createdAt
  };
}

export function persistedEventsToMoveLog(events: PersistedMoveEventRecord[]): MoveEvent[] {
  return [...events]
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map(persistedEventToMoveEvent);
}

export function reconstructGameState(events: PersistedMoveEventRecord[], config: Partial<GameConfig>, gameId?: string) {
  const state = events.length === 0
    ? createInitialGameState(config)
    : replayMoveLog(persistedEventsToMoveLog(events), config);

  return gameId ? { ...state, id: gameId } : state;
}

export function eventPlayer(action: GameAction): PlayerIndex | undefined {
  return "player" in action ? action.player : undefined;
}

export function eventType(action: GameAction): GameAction["type"] {
  return action.type;
}
