import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { apiError, gameConfigSchema, parseJsonBody } from "../_shared";
import type { JsonValue } from "@/lib/persistence/event-store";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request) as { config?: unknown; metadata?: JsonValue };
    const parsed = gameConfigSchema.parse(body.config);
    const game = await getEventStore().createGame({
      config: parsed,
      metadata: body.metadata ?? {}
    });

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
