import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerGameHistoryEntry {
  gameId: number;
  dateTime: string;
  teamSide: "HOME" | "AWAY";
  opponentTeamAverageElo: number;
  playerEloAtGame: number;
  goals: number;
  deltaELO: number;
  teamScore: number;
  opponentScore: number;
}

// GET player game history - all games a player participated in
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId: playerIdStr } = await params
    const playerId = parseInt(playerIdStr);

    if (isNaN(playerId)) {
      return NextResponse.json(
        { error: "Invalid player ID" },
        { status: 400 }
      );
    }

    // Get all games the player participated in
    const games = await prisma.game.findMany({
      where: {
        teamPlayers: {
          some: {
            playerId: playerId,
          },
        },
        timePlayed: {
          not: null, // Only finished games
        },
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        startDateTime: "asc", // Chronological order
      },
    });

    // Calculate ELO progression for this player
    const playerElos = new Map<number, number>();

    // Initialize all players to 1500
    const allPlayers = await prisma.player.findMany();
    for (const player of allPlayers) {
      playerElos.set(player.id, 1500);
    }

    // Build ELO timeline for all players
    const playerEloAtGameTime = new Map<number, Map<number, number>>(); // gameId -> (playerId -> elo)

    for (const game of games) {
      const gameElos = new Map<number, number>();

      // Store current ELOs for this game
      for (const tp of game.teamPlayers) {
        gameElos.set(tp.playerId, playerElos.get(tp.playerId) || 1500);
      }
      playerEloAtGameTime.set(game.id, gameElos);

      // Apply deltaELOs to update for next game
      for (const tp of game.teamPlayers) {
        const currentElo = playerElos.get(tp.playerId) || 1500;
        playerElos.set(tp.playerId, currentElo + tp.deltaELO);
      }
    }

    // Map to response format
    const playerGameHistory: PlayerGameHistoryEntry[] = games.map((game) => {
      const playerTeamPlayer = game.teamPlayers.find(
        (tp) => tp.playerId === playerId
      );

      if (!playerTeamPlayer) {
        throw new Error("Player not found in game");
      }

      const isHomeTeam = playerTeamPlayer.side === "HOME";
      const playerTeamPlayers = game.teamPlayers.filter(
        (tp) => tp.side === playerTeamPlayer.side
      );
      const opponentTeamPlayers = game.teamPlayers.filter(
        (tp) => tp.side !== playerTeamPlayer.side
      );

      const playerTeamScore = playerTeamPlayers.reduce(
        (sum, tp) => sum + tp.goals,
        0
      );
      const opponentScore = opponentTeamPlayers.reduce(
        (sum, tp) => sum + tp.goals,
        0
      );

      const opponentTeamAverageElo = isHomeTeam
        ? game.awayTeamAverageElo || 1500
        : game.homeTeamAverageElo || 1500;

      const gameElos = playerEloAtGameTime.get(game.id) || new Map();
      const playerEloAtGame = gameElos.get(playerId) || 1500;

      return {
        gameId: game.id,
        dateTime: game.startDateTime.toISOString(),
        teamSide: playerTeamPlayer.side,
        opponentTeamAverageElo,
        playerEloAtGame,
        goals: playerTeamPlayer.goals,
        deltaELO: playerTeamPlayer.deltaELO,
        teamScore: playerTeamScore,
        opponentScore,
      };
    });

    return NextResponse.json({ playerGameHistory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
