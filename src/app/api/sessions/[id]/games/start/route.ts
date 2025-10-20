import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Team } from '@prisma/client'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = parseInt(params.id)
        const body = await request.json()

        // Get the session
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                games: {
                    orderBy: { id: 'desc' },
                    take: 1,
                },
            },
        })

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            )
        }

        // Check if session date has passed
        if (new Date() < session.date) {
            return NextResponse.json(
                { error: 'Session has not started yet' },
                { status: 400 }
            )
        }

        let homeTeamNumber: Team
        let awayTeamNumber: Team
        let gameId: number

        if (session.status === 'SCHEDULED') {
            // First game - teams must be provided
            const { homeTeam, awayTeam } = body

            if (!homeTeam || !awayTeam) {
                return NextResponse.json(
                    { error: 'homeTeam and awayTeam are required for first game' },
                    { status: 400 }
                )
            }

            homeTeamNumber = homeTeam as Team
            awayTeamNumber = awayTeam as Team
            gameId = 1

            // Update session to IN_PROGRESS
            await prisma.session.update({
                where: { id: sessionId },
                data: { status: 'IN_PROGRESS' },
            })
        } else if (session.status === 'IN_PROGRESS') {
            // Determine teams based on previous game result
            const previousGame = session.games[0]

            if (!previousGame) {
                return NextResponse.json(
                    { error: 'No previous game found' },
                    { status: 400 }
                )
            }

            if (previousGame.status !== 'COMPLETED') {
                return NextResponse.json(
                    { error: 'Previous game is not completed' },
                    { status: 400 }
                )
            }

            gameId = previousGame.id + 1

            // Determine which team stays (winner or fresher team on draw)
            let stayingTeam: Team
            let waitingTeam: Team

            if (previousGame.homeScore > previousGame.awayScore) {
                // Home team won
                stayingTeam = previousGame.homeTeamNumber
                waitingTeam = previousGame.awayTeamNumber
            } else if (previousGame.awayScore > previousGame.homeScore) {
                // Away team won
                stayingTeam = previousGame.awayTeamNumber
                waitingTeam = previousGame.homeTeamNumber
            } else {
                // Draw - fresher team stays
                // Get all games to determine which team played less recently
                const allGames = await prisma.game.findMany({
                    where: { sessionId },
                    orderBy: { id: 'desc' },
                })

                // Find last time each team played
                let homeLastPlayed = -1
                let awayLastPlayed = -1

                for (let i = 0; i < allGames.length; i++) {
                    const game = allGames[i]
                    if (homeLastPlayed === -1 && (game.homeTeamNumber === previousGame.homeTeamNumber || game.awayTeamNumber === previousGame.homeTeamNumber)) {
                        homeLastPlayed = i
                    }
                    if (awayLastPlayed === -1 && (game.homeTeamNumber === previousGame.awayTeamNumber || game.awayTeamNumber === previousGame.awayTeamNumber)) {
                        awayLastPlayed = i
                    }
                    if (homeLastPlayed !== -1 && awayLastPlayed !== -1) break
                }

                // Fresher team (played less recently = larger index) stays
                if (homeLastPlayed > awayLastPlayed) {
                    stayingTeam = previousGame.homeTeamNumber
                    waitingTeam = previousGame.awayTeamNumber
                } else {
                    stayingTeam = previousGame.awayTeamNumber
                    waitingTeam = previousGame.homeTeamNumber
                }
            }

            // Find the waiting team (the one that didn't play last game)
            const allTeams: Team[] = ['TEAM_1', 'TEAM_2', 'TEAM_3']
            const newTeam = allTeams.find(
                t => t !== previousGame.homeTeamNumber && t !== previousGame.awayTeamNumber
            )!

            homeTeamNumber = stayingTeam
            awayTeamNumber = newTeam
        } else {
            return NextResponse.json(
                { error: 'Session is already completed' },
                { status: 400 }
            )
        }

        // Get player IDs for each team
        const homePlayerIds = session[`team${homeTeamNumber.split('_')[1]}PlayerIds` as keyof typeof session] as number[]
        const awayPlayerIds = session[`team${awayTeamNumber.split('_')[1]}PlayerIds` as keyof typeof session] as number[]

        // Create the game with GamePlayer records
        const game = await prisma.game.create({
            data: {
                id: gameId,
                sessionId,
                homeTeamNumber,
                awayTeamNumber,
                status: 'IN_PROGRESS',
                gamePlayers: {
                    create: [
                        ...homePlayerIds.map(playerId => ({
                            playerId,
                            teamNumber: homeTeamNumber,
                            sessionId,
                        })),
                        ...awayPlayerIds.map(playerId => ({
                            playerId,
                            teamNumber: awayTeamNumber,
                            sessionId,
                        })),
                    ],
                },
            },
            include: {
                gamePlayers: true,
            },
        })

        return NextResponse.json(game, { status: 201 })
    } catch (error) {
        console.error('Error starting game:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to start game', details: errorMessage },
            { status: 500 }
        )
    }
}
