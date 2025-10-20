import { PrismaClient } from "@prisma/client";
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
    try {
        // Get all sessions ordered by date descending (most recent first)
        const sessions = await prisma.session.findMany({
            orderBy: { date: 'desc' },
            include: {
                games: {
                    include: {
                        gamePlayers: true,
                    },
                },
            },
        });
        return NextResponse.json(sessions)
    } catch (error) {
        console.error('Error fetching sessions:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to fetch sessions', details: errorMessage },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { date, gameLengthMinutes, team1PlayerIds, team2PlayerIds, team3PlayerIds, autoBalance } = body

        // Validate input
        if (!date || !gameLengthMinutes) {
            return NextResponse.json(
                { error: 'Missing required fields: date, gameLengthMinutes' },
                { status: 400 }
            )
        }

        let finalTeam1: number[]
        let finalTeam2: number[]
        let finalTeam3: number[]

        if (autoBalance) {
            // Auto-balance teams based on ELO
            // Get all players ordered by ELO descending
            const players = await prisma.player.findMany({
                orderBy: { elo: 'desc' },
                where: {available: true},
                take: 15, // Take top 9 players
            })

            if (players.length < 15) {
                return NextResponse.json(
                    { error: 'Not enough players in database (need at least 9)' },
                    { status: 400 }
                )
            }

            // Balanced team assignment using snake draft
            // This creates three teams with balanced average ELO
            const team1: number[] = []
            const team2: number[] = []
            const team3: number[] = []

            // Snake draft pattern: 1->2->3, 3->2->1, 1->2->3
            team1.push(players[0].id) // Highest ELO
            team2.push(players[1].id)
            team3.push(players[2].id)
            team3.push(players[3].id) // Snake back
            team2.push(players[4].id)
            team1.push(players[5].id)
            team1.push(players[6].id) // Continue
            team2.push(players[7].id)
            team3.push(players[8].id)
            team3.push(players[9].id) // Continue
            team2.push(players[10].id)
            team1.push(players[11].id)
            team1.push(players[12].id) // Continue
            team2.push(players[13].id)
            team3.push(players[14].id)

            finalTeam1 = team1
            finalTeam2 = team2
            finalTeam3 = team3
        } else {
            // Manual team assignment
            if (!team1PlayerIds || !team2PlayerIds || !team3PlayerIds) {
                return NextResponse.json(
                    { error: 'Missing required fields: team1PlayerIds, team2PlayerIds, team3PlayerIds' },
                    { status: 400 }
                )
            }

            // Validate that each team has exactly 3 players
            if (team1PlayerIds.length !== 3 || team2PlayerIds.length !== 3 || team3PlayerIds.length !== 3) {
                return NextResponse.json(
                    { error: 'Each team must have exactly 3 players' },
                    { status: 400 }
                )
            }

            finalTeam1 = team1PlayerIds
            finalTeam2 = team2PlayerIds
            finalTeam3 = team3PlayerIds
        }

        // Create session
        const session = await prisma.session.create({
            data: {
                date: new Date(date),
                gameLengthMinutes,
                team1PlayerIds: finalTeam1,
                team2PlayerIds: finalTeam2,
                team3PlayerIds: finalTeam3,
                status: 'SCHEDULED',
            },
        })



        return NextResponse.json(session, { status: 201 })
    } catch (error) {
        console.error('Error creating session:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to create session', details: errorMessage },
            { status: 500 }
        )
    }
}

export async function PATCH() {
    // to update a SCHEDULED session ONLY. (team composition, game length or date).
}
