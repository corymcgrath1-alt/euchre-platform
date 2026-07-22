import type { PlayerIndex } from "@/lib/euchre";
import { getEventStore } from "@/lib/persistence/event-store";
import type { EventStore } from "@/lib/persistence/types";
import { buildClubReplayTimeline, type ClubReplayTimeline } from "@/lib/presentation/club/replay-timeline";

export type ReplayRouteProjection =
  | { readonly status: "ready"; readonly timeline: ClubReplayTimeline }
  | { readonly status: "empty"; readonly gameId: string }
  | { readonly status: "unavailable"; readonly gameId: string; readonly message: string };

export function isValidReviewId(reviewId: string): boolean {
  return /^[A-Za-z0-9_-]{1,160}$/.test(reviewId);
}

export async function loadReplayRouteProjection(
  reviewId: string,
  viewerSeat: PlayerIndex = 0,
  eventStore: EventStore = getEventStore()
): Promise<ReplayRouteProjection> {
  const loaded = await eventStore.loadGame(reviewId);
  if (loaded.events.length === 0) {
    return { status: "empty", gameId: loaded.game.id };
  }
  if (loaded.game.status !== "complete" || loaded.state.phase !== "gameComplete") {
    return {
      status: "unavailable",
      gameId: loaded.game.id,
      message: "This persisted game is unfinished. Replay becomes available after the authoritative final result."
    };
  }

  return {
    status: "ready",
    timeline: buildClubReplayTimeline({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events,
      viewerSeat
    })
  };
}
