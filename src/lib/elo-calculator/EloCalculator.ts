import {Game, GameResult} from "./Game"
import {Player} from "./Player"
import {Team} from "./Team"
import {EloParameters} from "./EloParameters"

export class EloCalculator {

    private readonly game: Game;
    private readonly result: GameResult;
    private readonly eloPot: number;

    constructor(game: Game) {
        this.game = game;
        this.result = game.getResult();
        this.eloPot = game.getEloPot();
    }

    public calculateGameElos(): Map<number, number> {

        const eloChanges = new Map<number, number>();

        const homeTeam = this.game.getHomeTeam();
        const awayTeam = this.game.getAwayTeam();

        // Calculate ELO changes for home team
        for (let i = 0; i < EloParameters.TEAM_SIZE; i++) {
            const player = homeTeam.players[i];
            const eloChange = this.calculatePlayerEloChange(player, homeTeam, awayTeam);
            eloChanges.set(player.playerId, eloChange);
        }

        // Calculate ELO changes for away team
        for (let i = 0; i < EloParameters.TEAM_SIZE; i++) {
            const player = awayTeam.players[i];
            const eloChange = this.calculatePlayerEloChange(player, awayTeam, homeTeam);
            eloChanges.set(player.playerId, eloChange);
        }

        return eloChanges;
    }

    /**
     *
     * @param player - the player to calculate share for
     * @param team - the player's team
     * @param teamWonElo - whether this team won ELO (true for wins, false for losses, false for draws)
     * @private
     *
     * This method computes the blended share of the pot for a specific player
     */
    private calculateTeamShare(player: Player, team: Team, teamWonElo: boolean): number {

        /**
         * Weight calculation depends on whether team is gaining or losing ELO:
         * - Gaining ELO: Use inverse-squared weights (lower ELO gains significantly more)
         * - Losing ELO: Use squared weights (higher ELO loses significantly more)
         * Squared weights create more pronounced differences than linear weights.
         */

        let playerWeight: number;
        let totalWeight: number;

        if (teamWonElo) {
            // Inverse-squared weighting for gains - lower ELO players get more
            playerWeight = 1 / (player.effectiveElo * player.effectiveElo);
            totalWeight = team.players.reduce((sum, p) => sum + 1 / (p.effectiveElo * p.effectiveElo), 0);
        } else {
            // Squared weighting for losses - higher ELO players lose more
            playerWeight = player.effectiveElo * player.effectiveElo;
            totalWeight = team.players.reduce((sum, p) => sum + p.effectiveElo * p.effectiveElo, 0);
        }

        const playerEloShare = playerWeight / totalWeight;

        const decisiveness = player.getDecisiveness(this.game);

        let individualShare = 1.0;

        if (teamWonElo) {
            individualShare = decisiveness * playerEloShare;
        } else {
            individualShare = playerEloShare / decisiveness;
        }

        return player.qFactor * individualShare + (1 - player.qFactor) * playerEloShare;
    }

    private calculatePlayerEloChange(
        player: Player,
        playerTeam: Team,
        opponentTeam: Team
    ): number {
        // Determine if this team won or lost ELO
        const teamWonElo = this.determineTeamWonElo(playerTeam, opponentTeam);

        // Calculate the blended share for this player based on whether team won/lost ELO
        console.log(player.name, "won or lost? -> " + teamWonElo);
        const blendedShare = this.calculateTeamShare(player, playerTeam, teamWonElo);

        // Calculate total shares for all teammates to determine scaling factor
        let totalTeammateShares = 0;
        for (const teammate of playerTeam.players) {
            totalTeammateShares += this.calculateTeamShare(teammate, playerTeam, teamWonElo);
        }
        console.log("total teamate shares: ", totalTeammateShares);
        const scalingFactor = this.eloPot / totalTeammateShares;
        console.log("scaling factor for ", player.name);

        // Return ELO change based on whether team won or lost ELO
        let eloChange: number;
        if (teamWonElo) {
            eloChange = Math.round(scalingFactor * blendedShare);
        } else {
            eloChange = -Math.round(scalingFactor * blendedShare);
        }

        // Apply draw multiplier to reduce ELO impact in draws
        if (this.result === GameResult.DRAW) {
            eloChange = Math.round(eloChange * EloParameters.DRAW_ELO_MULTIPLIER);
        }

        return eloChange;
    }

    /**
     * Determines if a team won or lost ELO based on the game result and expected score
     * In a draw: team wins ELO if they were expected to lose, loses ELO if expected to win
     * In a win/loss: team wins ELO on win, loses ELO on loss
     */
    private determineTeamWonElo(team: Team, opponentTeam: Team): boolean {
        if (this.result === GameResult.DRAW) {
            const expectedScore = this.getExpectedScore(team.effectiveAverageElo, opponentTeam.effectiveAverageElo);
            // Team wins ELO in a draw if expected score < 0.5 (they were the underdog)
            // Team loses ELO in a draw if expected score > 0.5 (they were the favorite)
            return expectedScore < EloParameters.DRAW_SCORE;
        } else if (this.result === GameResult.HOME_WIN) {
            return this.game.getHomeTeam() === team;
        } else {
            return this.game.getAwayTeam() === team;
        }
    }

    private getExpectedScore(playerElo: number, opponentElo: number): number {
        const diff = opponentElo - playerElo;
        return 1 / (1 + Math.pow(10, diff / EloParameters.ELO_DIFF_DIVISOR));
    }
}