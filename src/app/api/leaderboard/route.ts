import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Fetch all players from the database, ordered by ELO descending
    const players = await prisma.player.findMany({
      orderBy: {
        elo: 'desc'
      }
    })

    // Transform the data to match the LeaderboardPlayer type
    const leaderboard = players.map(player => ({
      id: player.id,
      playerName: `${player.firstName} ${player.lastName.charAt(0)}.`,
      currentElo: player.elo,
      W: player.wins,
      T: player.draws,
      L: player.losses,
      gamesPlayed: player.gamesPlayed,
      goals: player.totalGoals,
      eloChangeLastWeek: 0, // TODO: Calculate this from recent games
      lastGameDate: null, // TODO: Fetch from most recent GamePlayer entry
    }))

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', details: errorMessage },
      { status: 500 }
    )
  }
}
