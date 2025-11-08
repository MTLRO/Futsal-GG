import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/teams
 * Returns the current team compositions (A, B, C)
 */
export async function GET() {
  try {
    const teams = await prisma.teamComposition.findMany();

    const teamA = teams.find((t) => t.team === "A")?.playerIds || [];
    const teamB = teams.find((t) => t.team === "B")?.playerIds || [];
    const teamC = teams.find((t) => t.team === "C")?.playerIds || [];

    return NextResponse.json({
      teamA,
      teamB,
      teamC,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/teams
 * Update team compositions
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamA, teamB, teamC } = body;

    // Validate input
    if (!Array.isArray(teamA) || !Array.isArray(teamB) || !Array.isArray(teamC)) {
      return NextResponse.json(
        { error: "Teams must be arrays" },
        { status: 400 }
      );
    }

    if (teamA.length !== 5 || teamB.length !== 5 || teamC.length !== 5) {
      return NextResponse.json(
        { error: "Each team must have exactly 5 players" },
        { status: 400 }
      );
    }

    // Upsert team compositions
    await Promise.all([
      prisma.teamComposition.upsert({
        where: { team: "A" },
        update: { playerIds: teamA },
        create: { team: "A", playerIds: teamA },
      }),
      prisma.teamComposition.upsert({
        where: { team: "B" },
        update: { playerIds: teamB },
        create: { team: "B", playerIds: teamB },
      }),
      prisma.teamComposition.upsert({
        where: { team: "C" },
        update: { playerIds: teamC },
        create: { team: "C", playerIds: teamC },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
