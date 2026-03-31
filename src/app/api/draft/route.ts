import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * POST /api/draft
 * Creates a new draft session with selected player IDs (minimum 6 players).
 * Sorts players by ELO descending and generates 3 captain tokens.
 */
export async function POST(request: Request) {
  try {
    const { playerIds } = await request.json();

    if (!Array.isArray(playerIds) || playerIds.length < 6) {
      return NextResponse.json(
        { error: "At least 6 player IDs required" },
        { status: 400 }
      );
    }

    // Fetch players and sort by ELO descending
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      orderBy: { elo: "desc" },
    });

    if (players.length !== playerIds.length) {
      return NextResponse.json(
        { error: "One or more player IDs not found" },
        { status: 400 }
      );
    }

    const sortedPlayerIds = players.map((p) => p.id);

    const session = await prisma.draftSession.create({
      data: {
        playerIds: sortedPlayerIds,
        picks: [],
        captain1Token: randomUUID(),
        captain2Token: randomUUID(),
        captain3Token: randomUUID(),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      captain1Token: session.captain1Token,
      captain2Token: session.captain2Token,
      captain3Token: session.captain3Token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
