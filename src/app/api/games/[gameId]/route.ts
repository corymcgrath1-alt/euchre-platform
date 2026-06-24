import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { apiError } from "../../_shared";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const loaded = await getEventStore().loadGame(gameId);
    return NextResponse.json(loaded);
  } catch (error) {
    return apiError(error);
  }
}
