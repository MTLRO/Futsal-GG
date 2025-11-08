import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET current game
export async function GET() {
  try {
    const game = await prisma.game.findFirst({
      where: { timePlayed: null },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ game: null });
    }

    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST startGame - creates new live game
export async function POST() {
  try {
    // Create new game with current time
    const game = await prisma.game.create({
      data: {
        startDateTime: new Date(),
      },
    });

    return NextResponse.json({ gameId: game.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
