import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { apiError, gameActionSchema, parseJsonBody } from "../../../_shared";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const events = await getEventStore().loadMoveHistory(gameId);
    return NextResponse.json({ events });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const body = await parseJsonBody(request) as { expectedSequence?: unknown; action?: unknown };
    const event = await getEventStore().appendMove({
      gameId,
      expectedSequence: Number(body.expectedSequence),
      action: gameActionSchema.parse(body.action)
    });
    const loaded = await getEventStore().loadGame(gameId);

    return NextResponse.json({ event, state: loaded.state, game: loaded.game }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
