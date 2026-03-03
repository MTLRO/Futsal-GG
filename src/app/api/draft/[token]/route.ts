import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PICK_ORDER, TOTAL_PICKS } from "@/lib/draft-utils";

function getCaptainIndex(session: {
  captain1Token: string;
  captain2Token: string;
  captain3Token: string;
}, token: string): number | null {
  if (token === session.captain1Token) return 0;
  if (token === session.captain2Token) return 1;
  if (token === session.captain3Token) return 2;
  return null;
}

/**
 * GET /api/draft/[token]
 * Returns the current draft state for the given captain token.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const session = await prisma.draftSession.findFirst({
      where: {
        OR: [
          { captain1Token: token },
          { captain2Token: token },
          { captain3Token: token },
        ],
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Draft session not found" }, { status: 404 });
    }

    const captainIndex = getCaptainIndex(session, token);

    // Fetch all 15 players
    const players = await prisma.player.findMany({
      where: { id: { in: session.playerIds } },
      select: { id: true, name: true, lastName: true, elo: true },
    });

    // Sort by the original ranked order (ELO desc)
    const rankedPlayers = session.playerIds.map((id) =>
      players.find((p) => p.id === id)!
    );

    const currentPickIndex = session.picks.length;
    const isComplete = session.status === "COMPLETED";
    const currentCaptain = isComplete ? null : PICK_ORDER[currentPickIndex];

    return NextResponse.json({
      captainIndex,
      players: rankedPlayers,
      picks: session.picks,
      currentPickIndex,
      currentCaptain,
      status: session.status,
      captain1Token: session.captain1Token,
      captain2Token: session.captain2Token,
      captain3Token: session.captain3Token,
      captain1PlayerId: session.captain1PlayerId,
      captain2PlayerId: session.captain2PlayerId,
      captain3PlayerId: session.captain3PlayerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/draft/[token]
 * Sets the captain's player identity.
 * Body: { playerId: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { playerId } = await request.json();

    const session = await prisma.draftSession.findFirst({
      where: {
        OR: [
          { captain1Token: token },
          { captain2Token: token },
          { captain3Token: token },
        ],
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Draft session not found" }, { status: 404 });
    }

    const captainIndex = getCaptainIndex(session, token);
    if (captainIndex === null) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (!session.playerIds.includes(playerId)) {
      return NextResponse.json({ error: "Player not in this draft" }, { status: 400 });
    }

    // Check not already claimed by another captain
    const takenByOther = [session.captain1PlayerId, session.captain2PlayerId, session.captain3PlayerId]
      .some((id, i) => id === playerId && i !== captainIndex);

    if (takenByOther) {
      return NextResponse.json({ error: "This player is already identified by another captain" }, { status: 409 });
    }

    const field = (["captain1PlayerId", "captain2PlayerId", "captain3PlayerId"] as const)[captainIndex];

    await prisma.draftSession.update({
      where: { id: session.id },
      data: { [field]: playerId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/draft/[token]
 * Makes a pick for the captain identified by this token.
 * Body: { playerId: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { playerId } = await request.json();

    const session = await prisma.draftSession.findFirst({
      where: {
        OR: [
          { captain1Token: token },
          { captain2Token: token },
          { captain3Token: token },
        ],
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Draft session not found" }, { status: 404 });
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json({ error: "Draft is already complete" }, { status: 400 });
    }

    // All captains must have identified before picking starts
    if (!session.captain1PlayerId || !session.captain2PlayerId || !session.captain3PlayerId) {
      return NextResponse.json({ error: "All captains must identify before drafting begins" }, { status: 400 });
    }

    const captainIndex = getCaptainIndex(session, token);
    const currentPickIndex = session.picks.length;

    if (currentPickIndex >= TOTAL_PICKS) {
      return NextResponse.json({ error: "All picks have been made" }, { status: 400 });
    }

    if (PICK_ORDER[currentPickIndex] !== captainIndex) {
      return NextResponse.json({ error: "Not your turn to pick" }, { status: 403 });
    }

    if (!session.playerIds.includes(playerId)) {
      return NextResponse.json({ error: "Player not in this draft" }, { status: 400 });
    }

    if (session.picks.includes(playerId)) {
      return NextResponse.json({ error: "Player already picked" }, { status: 400 });
    }

    // Block picking a captain's identified player
    const captainPlayerIds = [session.captain1PlayerId, session.captain2PlayerId, session.captain3PlayerId];
    if (captainPlayerIds.includes(playerId)) {
      return NextResponse.json({ error: "Cannot pick a captain — they are already on their team" }, { status: 400 });
    }

    const newPicks = [...session.picks, playerId];
    const isComplete = newPicks.length === TOTAL_PICKS;

    if (isComplete) {
      const teamA: number[] = [session.captain1PlayerId];
      const teamB: number[] = [session.captain2PlayerId];
      const teamC: number[] = [session.captain3PlayerId];

      for (let i = 0; i < TOTAL_PICKS; i++) {
        const cap = PICK_ORDER[i];
        if (cap === 0) teamA.push(newPicks[i]);
        else if (cap === 1) teamB.push(newPicks[i]);
        else teamC.push(newPicks[i]);
      }

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
    }

    const updated = await prisma.draftSession.update({
      where: { id: session.id },
      data: {
        picks: newPicks,
        status: isComplete ? "COMPLETED" : "ACTIVE",
      },
    });

    return NextResponse.json({
      picks: updated.picks,
      status: updated.status,
      currentPickIndex: updated.picks.length,
      currentCaptain: isComplete ? null : PICK_ORDER[updated.picks.length],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
