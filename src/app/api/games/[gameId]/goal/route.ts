import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST goal - increment goals for a player in a game
export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "Missing playerId" },
        { status: 400 }
      );
    }

    // Find the team player record and increment goals
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

    const updated = await prisma.teamPlayer.update({
      where: { id: teamPlayer.id },
      data: {
        goals: {
          increment: 1,
        },
      },
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
