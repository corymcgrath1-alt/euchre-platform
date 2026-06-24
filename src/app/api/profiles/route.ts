import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { buildProfileAggregates } from "@/lib/profiles/profile-aggregates";
import { buildGameReview } from "@/lib/review/game-review";
import { apiError } from "../_shared";

export async function GET() {
  try {
    const store = getEventStore();
    const games = await store.listGames("complete");
    const reviews = await Promise.all(
      games.map(async (game) => buildGameReview({
        gameId: game.id,
        config: game.config,
        events: await store.loadMoveHistory(game.id)
      }))
    );

    return NextResponse.json({ profiles: buildProfileAggregates(reviews) });
  } catch (error) {
    return apiError(error);
  }
}
