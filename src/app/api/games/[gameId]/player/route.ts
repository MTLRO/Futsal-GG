import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// PATCH - Update player data in a game (goals, goalkeeper status)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { playerId, goals, goalkeeper } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "Missing playerId" },
        { status: 400 }
      );
    }

    // Find the team player record
    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: {
        gameId,
        playerId,
      },
    });

    if (!teamPlayer) {
      return NextResponse.json(
        { error: "Player not found in this game" },
        { status: 404 }
      );
    }

    // Build update data object
    const updateData: { goals?: number; goalkeeper?: boolean } = {};
    if (goals !== undefined) updateData.goals = goals;
    if (goalkeeper !== undefined) updateData.goalkeeper = goalkeeper;

    const updated = await prisma.teamPlayer.update({
      where: { id: teamPlayer.id },
      data: updateData,
      include: {
        player: true,
      },
    });

    return NextResponse.json({ teamPlayer: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
