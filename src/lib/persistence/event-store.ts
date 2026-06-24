import { LocalEventStore } from "./local-event-store";
import { SupabaseEventStore } from "./supabase-event-store";
import type { EventStore } from "./types";

let store: EventStore | null = null;

export function getEventStore(): EventStore {
  if (store) {
    return store;
  }

  store = SupabaseEventStore.fromEnv() ?? new LocalEventStore();
  return store;
}

export function resetEventStoreForTests(nextStore: EventStore | null = null): void {
  store = nextStore;
}

export * from "./local-event-store";
export * from "./replay";
export * from "./types";
