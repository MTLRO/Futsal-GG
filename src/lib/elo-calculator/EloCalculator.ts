import {Game, GameResult} from "./Game"
import {Player} from "./Player"
import {Team} from "./Team"
import {EloParameters} from "./EloParameters"
import {Result} from "./Result"

export class EloCalculator {

    private readonly game: Game;
    private playerEloChanges = new Map<Player, number>();

    constructor(game: Game) {
        this.game = game;
        this.compute();
    }

    /**
     * Returns the ELO changes for all players after computation.
     */
    public getPlayerEloChanges(): Map<Player, number> {
        return this.playerEloChanges;
    }

    /**
     * Main computation method - calculates ELO changes for all players.
     */
    private compute(): void {
        const team1 = this.game.getTeam1();
        const team2 = this.game.getTeam2();

        // Compute expected scores for each team
        const expectedScoreTeam1 = this.getExpectedScore(team1.elo, team2.elo);
        const expectedScoreTeam2 = 1 - expectedScoreTeam1;

        // Get actual scores based on game result
        const actualScoreTeam1 = this.getActualScore(team1);
        const actualScoreTeam2 = this.getActualScore(team2);

        // Compute and share ELO for each team
        this.shareEloWithPlayers(team1, team2, expectedScoreTeam1, actualScoreTeam1);
        this.shareEloWithPlayers(team2, team1, expectedScoreTeam2, actualScoreTeam2);
    }

    /**
     * Calculates the expected score using standard ELO formula.
     * @param teamElo - The team's total ELO
     * @param opponentElo - The opponent team's total ELO
     * @returns Expected score between 0 and 1
     */
    private getExpectedScore(teamElo: number, opponentElo: number): number {
        const eloDiff = opponentElo - teamElo;
        return 1 / (1 + Math.pow(10, eloDiff / EloParameters.ELO_DIFF_DIVISOR));
    }

    /**
     * Gets the actual score for a team based on game result.
     */
    private getActualScore(team: Team): number {
        if (this.game.winningTeam === team) {
            return EloParameters.WIN_SCORE;
        } else if (this.game.losingTeam === team) {
            return EloParameters.LOSS_SCORE;
        } else {
            return EloParameters.DRAW_SCORE;
        }
    }

    /**
     * Computes the base ELO pot for a team (before individual distribution).
     * This is the raw score difference that will be distributed among players.
     */
    private getTeamEloPot(expectedScore: number, actualScore: number): number {
        let scoreDiff = actualScore - expectedScore;

        // Apply draw multiplier if it's a draw
        if (actualScore === EloParameters.DRAW_SCORE) {
            scoreDiff *= EloParameters.DRAW_ELO_MULTIPLIER;
        }

        return scoreDiff;
    }

    /**
     * Distributes ELO changes among players on a team using the two-pot system.
     * Pot 1: Team-based (inversely proportional to ELO)
     * Pot 2: Performance-based (based on decisiveness)
     * Final: Blended using each player's qFactor
     */
    private shareEloWithPlayers(team: Team, opponentTeam: Team, expectedScore: number, actualScore: number): void {
        const eloPot = this.getTeamEloPot(expectedScore, actualScore);
        const isWin = actualScore > expectedScore;

        // Calculate team totals for distribution
        const teamGoals = this.game.getTeamGoals(team);
        const opponentGoals = this.game.getTeamGoals(opponentTeam);

        // Calculate weights for both distribution methods
        const teamBasedWeights = this.calculateTeamBasedWeights(team, isWin);
        const performanceWeights = this.calculatePerformanceWeights(team, opponentTeam, teamGoals, opponentGoals);

        // Normalize weights
        const teamBasedTotal = Array.from(teamBasedWeights.values()).reduce((a, b) => a + b, 0);
        const performanceTotal = Array.from(performanceWeights.values()).reduce((a, b) => a + b, 0);

        // Distribute ELO to each player
        for (const player of team.players) {
            // Normalize weights for this player
            const teamBasedShare = teamBasedTotal > 0
                ? (teamBasedWeights.get(player) ?? 0) / teamBasedTotal
                : 1 / team.players.length;
            const performanceShare = performanceTotal > 0
                ? (performanceWeights.get(player) ?? 0) / performanceTotal
                : 1 / team.players.length;

            // Blend using qFactor: high qFactor = more performance-based
            const qFactor = player.qFactor;
            const blendedShare = (1 - qFactor) * teamBasedShare + qFactor * performanceShare;

            // Apply K-factor individually
            const kFactor = player.getKFactor();
            const eloChange = kFactor * eloPot * blendedShare * team.players.length;

            this.playerEloChanges.set(player, eloChange);
        }
    }

    /**
     * Calculates team-based distribution weights.
     * For wins: lower ELO = higher weight (they benefit more)
     * For losses: higher ELO = higher weight (they lose more)
     */
    private calculateTeamBasedWeights(team: Team, isWin: boolean): Map<Player, number> {
        const weights = new Map<Player, number>();
        const teamTotalElo = team.elo;

        for (const player of team.players) {
            const playerEloRatio = player.elo / teamTotalElo;

            if (isWin) {
                // For wins: inverse proportion - lower ELO players get more
                weights.set(player, 1 - playerEloRatio);
            } else {
                // For losses: direct proportion - higher ELO players lose more
                weights.set(player, playerEloRatio);
            }
        }

        return weights;
    }

    /**
     * Calculates performance-based distribution weights using decisiveness multiplier.
     * On losses, inverts the multiplier so goal scorers lose less.
     */
    private calculatePerformanceWeights(team: Team, opponentTeam: Team, teamGoals: number, opponentGoals: number): Map<Player, number> {
        const weights = new Map<Player, number>();
        const isLoss = this.game.losingTeam === team;

        for (const player of team.players) {
            const playerGoals = this.game.getPlayerGoals(player);
            const teammateGoals = teamGoals - playerGoals;
            const isGoalKeeper = team.isGoalKeeper(player);

            let decisiveness = player.getDecisivenessMultiplier(
                playerGoals,
                teammateGoals,
                opponentGoals,
                isGoalKeeper
            );

            // On losses: invert decisiveness so goal scorers get less weight (lose less)
            // Use squared reciprocal for stronger effect: 1 / (decisiveness^2)
            // This ensures goal scorers lose significantly less ELO on losses
            if (isLoss) {
                decisiveness = 1 / (decisiveness * decisiveness);
            }

            weights.set(player, decisiveness);
        }

        return weights;
    }

    /**
     * Inverts performance weights for losses.
     * This ensures goal scorers lose significantly less ELO on losses.
     * Uses reciprocal-based inversion for strong effect.
     */
    private invertPerformanceWeights(weights: Map<Player, number>): Map<Player, number> {
        const invertedWeights = new Map<Player, number>();

        // Use reciprocal inversion: 1/weight
        // This creates a strong inverse effect where high performers get very low weights on losses
        let totalInvertedWeight = 0;
        const tempWeights = new Map<Player, number>();

        for (const [player, weight] of weights) {
            const invertedWeight = 1 / weight;
            tempWeights.set(player, invertedWeight);
            totalInvertedWeight += invertedWeight;
        }

        // Normalize so they sum to same total as original for fair distribution
        const originalTotal = Array.from(weights.values()).reduce((a, b) => a + b, 0);
        const scaleFactor = originalTotal / totalInvertedWeight;

        for (const [player, invertedWeight] of tempWeights) {
            invertedWeights.set(player, invertedWeight * scaleFactor);
        }

        return invertedWeights;
    }
}