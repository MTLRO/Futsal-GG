import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET all players
export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: {
        lastName: "asc",
      },
    });

    return NextResponse.json({ players });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST addPlayer - create new player
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, lastName } = body;

    if (!name || !lastName) {
      return NextResponse.json(
        { error: "Missing name or lastName" },
        { status: 400 }
      );
    }

    const player = await prisma.player.create({
      data: {
        name,
        lastName,
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
