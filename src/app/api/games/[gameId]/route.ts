import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET game by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH endGame - sets timePlayed
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { timePlayed } = body;

    if (timePlayed === undefined || timePlayed === null) {
      return NextResponse.json(
        { error: "Missing timePlayed" },
        { status: 400 }
      );
    }

    const game = await prisma.game.update({
      where: { id: gameId },
      data: { timePlayed },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
