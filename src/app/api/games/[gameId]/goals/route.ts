import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST - Create a new goal with timestamp
export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { playerId, timestamp } = body;

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

    // Create the goal record
    const goal = await prisma.goal.create({
      data: {
        teamPlayerId: teamPlayer.id,
        timestamp: timestamp || null,
      },
    });

    // Update the goals count
    await prisma.teamPlayer.update({
      where: { id: teamPlayer.id },
      data: {
        goals: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update all goals for a team player (used to set/update timestamps for existing goals)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { playerId, goalTimestamps } = body;

    if (!playerId || !Array.isArray(goalTimestamps)) {
      return NextResponse.json(
        { error: "Missing playerId or goalTimestamps array" },
        { status: 400 }
      );
    }

    // Find the team player record
    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: {
        gameId,
        playerId,
      },
      include: {
        goalDetails: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!teamPlayer) {
      return NextResponse.json(
        { error: "Player not found in this game" },
        { status: 404 }
      );
    }

    // Get current goals count
    const currentGoalsCount = teamPlayer.goalDetails.length;
    const newGoalsCount = goalTimestamps.length;

    // If we need to add goals
    if (newGoalsCount > currentGoalsCount) {
      const goalsToAdd = newGoalsCount - currentGoalsCount;
      for (let i = 0; i < goalsToAdd; i++) {
        await prisma.goal.create({
          data: {
            teamPlayerId: teamPlayer.id,
            timestamp: null,
          },
        });
      }
    }
    // If we need to remove goals
    else if (newGoalsCount < currentGoalsCount) {
      const goalsToRemove = currentGoalsCount - newGoalsCount;
      const goalsToDelete = teamPlayer.goalDetails.slice(-goalsToRemove);
      await prisma.goal.deleteMany({
        where: {
          id: {
            in: goalsToDelete.map(g => g.id),
          },
        },
      });
    }

    // Fetch updated goal details
    const updatedTeamPlayer = await prisma.teamPlayer.findUnique({
      where: { id: teamPlayer.id },
      include: {
        goalDetails: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Update timestamps for all goals
    if (updatedTeamPlayer) {
      for (let i = 0; i < goalTimestamps.length; i++) {
        const goal = updatedTeamPlayer.goalDetails[i];
        if (goal) {
          await prisma.goal.update({
            where: { id: goal.id },
            data: { timestamp: goalTimestamps[i] },
          });
        }
      }

      // Update the goals count to match
      await prisma.teamPlayer.update({
        where: { id: teamPlayer.id },
        data: { goals: newGoalsCount },
      });
    }

    // Fetch final state
    const finalTeamPlayer = await prisma.teamPlayer.findUnique({
      where: { id: teamPlayer.id },
      include: {
        goalDetails: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return NextResponse.json({ teamPlayer: finalTeamPlayer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
