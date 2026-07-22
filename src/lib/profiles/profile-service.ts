import { getEventStore } from "@/lib/persistence/event-store";
import type { EventStore } from "@/lib/persistence/types";
import { buildGameReview } from "@/lib/review/game-review";
import type { PlayerIndex } from "@/lib/euchre";
import { buildProfileAggregates, type ProfileAggregateSummary } from "./profile-aggregates";
import {
  buildPlayerProfileDetail,
  type PlayerProfileDetail,
  type ProfileReviewSource
} from "./profile-detail";

export interface ProfileProjectionBundle {
  summary: ProfileAggregateSummary;
  profile: PlayerProfileDetail;
}

export async function loadCompletedProfileSources(
  eventStore: EventStore = getEventStore()
): Promise<ProfileReviewSource[]> {
  const games = await eventStore.listGames("complete");

  return Promise.all(
    games.map(async (game) => ({
      review: buildGameReview({
        gameId: game.id,
        config: game.config,
        events: await eventStore.loadMoveHistory(game.id)
      }),
      createdAt: game.createdAt,
      completedAt: game.completedAt
    }))
  );
}

export async function loadProfileAggregateSummary(
  eventStore: EventStore = getEventStore()
): Promise<ProfileAggregateSummary> {
  const sources = await loadCompletedProfileSources(eventStore);
  return buildProfileAggregates(sources.map((source) => source.review));
}

export async function loadPlayerProfileProjection(
  seat: PlayerIndex,
  eventStore: EventStore = getEventStore()
): Promise<PlayerProfileDetail> {
  return buildPlayerProfileDetail(await loadCompletedProfileSources(eventStore), seat);
}

export async function loadProfileProjectionBundle(
  seat: PlayerIndex,
  eventStore: EventStore = getEventStore()
): Promise<ProfileProjectionBundle> {
  const sources = await loadCompletedProfileSources(eventStore);

  return {
    summary: buildProfileAggregates(sources.map((source) => source.review)),
    profile: buildPlayerProfileDetail(sources, seat)
  };
}
