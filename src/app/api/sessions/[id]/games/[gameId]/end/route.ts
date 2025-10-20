import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Team } from '@prisma/client'

// Utility function: U(x) = max(0, x)
function U(x: number): number {
    return Math.max(0, x)
}

// Calculate ELO change for a single player
function calculatePlayerEloChange(
    playerGoals: number,
    teamGoals: number,
    opponentGoals: number,
    teamAvgElo: number,
    opponentAvgElo: number,
    allTeamGoals: number[],
    consecutiveGamesTeam: number,
    consecutiveGamesOpponent: number,
    playerGamesPlayed: number
): number {
    // ============================================================
    // CONTINUOUS UTILITY FUNCTION
    // ============================================================
    function U(goalDiff: number): number {
        const k = 2.5  // Sensitivity (lower = more sensitive to small differences)
        return Math.tanh(goalDiff / k)
    }

    // ============================================================
    // STEP 1: Calculate decisiveness (alpha) with continuous U
    // ============================================================
    const actualGoalDiff = teamGoals - opponentGoals
    const hypotheticalGoalDiff = (teamGoals - playerGoals) - opponentGoals

    const U_actual = U(actualGoalDiff)
    const U_hypothetical = U(hypotheticalGoalDiff)

    const alpha = U_actual - U_hypothetical
    // Note: alpha can now be negative (player hurt team) or positive (player helped)

    // ============================================================
    // STEP 2: Calculate expected score (E_A)
    // ============================================================
    let freshnessAdvantage = 0
    if (consecutiveGamesTeam < consecutiveGamesOpponent) {
        freshnessAdvantage = 65
    } else if (consecutiveGamesTeam > consecutiveGamesOpponent) {
        freshnessAdvantage = -65
    }

    const teamAdjustedElo = teamAvgElo - (50 * consecutiveGamesTeam) + freshnessAdvantage
    const opponentAdjustedElo = opponentAvgElo - (50 * consecutiveGamesOpponent) - freshnessAdvantage

    const eloDiff = teamAdjustedElo - opponentAdjustedElo
    const E_A = 1 / (1 + Math.pow(10, -eloDiff / 400))

    // ============================================================
    // STEP 3: Calculate actual score (S_A)
    // ============================================================
    let S_A: number
    if (teamGoals > opponentGoals) {
        S_A = 1
    } else if (teamGoals < opponentGoals) {
        S_A = 0
    } else {
        if (consecutiveGamesTeam < consecutiveGamesOpponent) {
            S_A = 0.6
        } else if (consecutiveGamesTeam > consecutiveGamesOpponent) {
            S_A = 0.4
        } else {
            S_A = 0.5
        }
    }

    // ============================================================
    // STEP 4: Calculate total pot
    // ============================================================
    const goalDiffMultiplier = Math.cbrt(Math.abs(teamGoals - opponentGoals) + 1)
    const C_A = (S_A - E_A) * goalDiffMultiplier

    // ============================================================
    // STEP 5: Calculate all betas for team
    // ============================================================
    const allBetas = allTeamGoals.map(g => {
        const hypoDiff = (teamGoals - g) - opponentGoals
        const alpha_j = U(actualGoalDiff) - U(hypoDiff)
        return 1 + alpha_j
    })

    const beta = 1 + alpha

    // ============================================================
    // STEP 6: Invert weights for losses
    // ============================================================
    let effective_beta: number
    let sum_effective_beta: number

    if (C_A < 0) {
        // LOSS: Invert beta so high performers lose LESS
        effective_beta = 2 - beta
        const all_effective_betas = allBetas.map(b => 2 - b)
        sum_effective_beta = all_effective_betas.reduce((sum, b) => sum + b, 0)
    } else {
        // WIN: Use beta normally so high performers gain MORE
        effective_beta = beta
        sum_effective_beta = allBetas.reduce((sum, b) => sum + b, 0)
    }

    const weight = effective_beta / sum_effective_beta

    // ============================================================
    // STEP 7: Calculate individual and team components
    // ============================================================
    const individual_component = weight * C_A
    const team_component = C_A / 5

    // ============================================================
    // STEP 8: Blend with q-factor
    // ============================================================
    const q = Math.max(0.5, 1.0 - 0.01 * playerGamesPlayed)

    const deltaElo = q * individual_component + (1 - q) * team_component

    return Math.round(deltaElo)
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = parseInt(params.id)
        const body = await request.json()
        const { gameId, durationSeconds } = body

        if (!gameId || durationSeconds === undefined) {
            return NextResponse.json(
                { error: 'gameId and durationSeconds are required' },
                { status: 400 }
            )
        }

        // Get the game with all players
        const game = await prisma.game.findUnique({
            where: {
                sessionId_id: {
                    sessionId,
                    id: gameId,
                },
            },
            include: {
                gamePlayers: {
                    include: {
                        player: true,
                    },
                },
            },
        })

        if (!game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            )
        }

        if (game.status === 'COMPLETED') {
            return NextResponse.json(
                { error: 'Game is already completed' },
                { status: 400 }
            )
        }
        const homePlayers = await prisma.gamePlayer.findMany({
            where: {
                sessionId: game.sessionId,
                gameId: game.id,
                teamNumber: game.homeTeamNumber
            }
        });
        // Separate players by team
        const awayPlayers = await prisma.gamePlayer.findMany({
            where: {
                sessionId: game.sessionId,
                gameId: game.id,
                teamNumber: game.awayTeamNumber
            }
        });
        // Calculate team scores from goals
        const homeScore = homePlayers.reduce((sum, gp) => sum + gp.goals, 0)
        const awayScore = awayPlayers.reduce((sum, gp) => sum + gp.goals, 0)

        // Calculate average ELO for each team
        const homeAvgElo = homePlayers.reduce((sum, gp) => sum + gp.player.elo, 0) / homePlayers.length
        const awayAvgElo = awayPlayers.reduce((sum, gp) => sum + gp.player.elo, 0) / awayPlayers.length

        // Get all player goals for each team
        const homePlayerGoals = homePlayers.map(gp => gp.goals)
        const awayPlayerGoals = awayPlayers.map(gp => gp.goals)

        // Calculate consecutive games played by each team
        let consecutiveGamesHome = 1 // Current game counts as 1
        let consecutiveGamesAway = 1

        if (gameId > 1) {
            // Get previous games in reverse order (most recent first)
            const previousGames = await prisma.game.findMany({
                where: {
                    sessionId,
                    id: { lt: gameId },
                },
                orderBy: { id: 'desc' },
            })

            // Count consecutive games for home team (going backwards)
            for (const prevGame of previousGames) {
                if (prevGame.homeTeamNumber === game.homeTeamNumber || prevGame.awayTeamNumber === game.homeTeamNumber) {
                    consecutiveGamesHome++
                } else {
                    break
                }
            }

            // Count consecutive games for away team (going backwards)
            for (const prevGame of previousGames) {
                if (prevGame.homeTeamNumber === game.awayTeamNumber || prevGame.awayTeamNumber === game.awayTeamNumber) {
                    consecutiveGamesAway++
                } else {
                    break
                }
            }
        }

        // Calculate ELO changes for each player
        const eloChanges: { playerId: number; eloChange: number; newElo: number }[] = []

        for (const gp of homePlayers) {
            const eloChange = calculatePlayerEloChange(
                gp.goals,
                homeScore,
                awayScore,
                homeAvgElo,
                awayAvgElo,
                homePlayerGoals,
                consecutiveGamesHome,
                consecutiveGamesAway,
                gp.player.gamesPlayed
            )
            eloChanges.push({
                playerId: gp.playerId,
                eloChange,
                newElo: gp.player.elo + eloChange,
            })
        }

        for (const gp of awayPlayers) {
            const eloChange = calculatePlayerEloChange(
                gp.goals,
                awayScore,
                homeScore,
                awayAvgElo,
                homeAvgElo,
                awayPlayerGoals,
                consecutiveGamesAway,
                consecutiveGamesHome,
                gp.player.gamesPlayed
            )
            eloChanges.push({
                playerId: gp.playerId,
                eloChange,
                newElo: gp.player.elo + eloChange,
            })
        }

        // Determine game outcome for each player
        const homeOutcome = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw'
        const awayOutcome = awayScore > homeScore ? 'win' : awayScore < homeScore ? 'loss' : 'draw'

        // Update game status and scores
        await prisma.game.update({
            where: {
                sessionId_id: {
                    sessionId,
                    id: gameId,
                },
            },
            data: {
                status: 'COMPLETED',
                homeScore,
                awayScore,
                durationSeconds,
            },
        })

        // Update all GamePlayer records with ELO changes
        for (const change of eloChanges) {
            const gp = game.gamePlayers.find(g => g.playerId === change.playerId)!
            await prisma.gamePlayer.update({
                where: {
                    sessionId_gameId_playerId: {
                        sessionId,
                        gameId,
                        playerId: change.playerId,
                    },
                },
                data: {
                    eloChange: change.eloChange,
                },
            })
        }

        // Update all Player records with new ELO and stats
        for (const gp of homePlayers) {
            const change = eloChanges.find(c => c.playerId === gp.playerId)!
            await prisma.player.update({
                where: { id: gp.playerId },
                data: {
                    elo: change.newElo,
                    totalGoals: { increment: gp.goals },
                    gamesPlayed: { increment: 1 },
                    wins: homeOutcome === 'win' ? { increment: 1 } : undefined,
                    draws: homeOutcome === 'draw' ? { increment: 1 } : undefined,
                    losses: homeOutcome === 'loss' ? { increment: 1 } : undefined,
                },
            })
        }

        for (const gp of awayPlayers) {
            const change = eloChanges.find(c => c.playerId === gp.playerId)!
            await prisma.player.update({
                where: { id: gp.playerId },
                data: {
                    elo: change.newElo,
                    totalGoals: { increment: gp.goals },
                    gamesPlayed: { increment: 1 },
                    wins: awayOutcome === 'win' ? { increment: 1 } : undefined,
                    draws: awayOutcome === 'draw' ? { increment: 1 } : undefined,
                    losses: awayOutcome === 'loss' ? { increment: 1 } : undefined,
                },
            })
        }

        // Get updated game with all changes
        const updatedGame = await prisma.game.findUnique({
            where: {
                sessionId_id: {
                    sessionId,
                    id: gameId,
                },
            },
            include: {
                gamePlayers: {
                    include: {
                        player: true,
                    },
                },
            },
        })

        return NextResponse.json({
            game: updatedGame,
            eloChanges,
        })
    } catch (error) {
        console.error('Error ending game:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to end game', details: errorMessage },
            { status: 500 }
        )
    }
}
