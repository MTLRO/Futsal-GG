import {Game, GameResult} from "./Game"
import {Player} from "./Player"
import {Team} from "./Team"
import {EloParameters} from "./EloParameters"

export class EloCalculator {

    private game: Game;
    private result: GameResult;
    private eloPot: number;

    constructor(game: Game) {
        this.game = game;
        this.result = game.getResult();
        this.eloPot = game.getEloPot();
    }

    public calculateGameElos(): Map<number, number> {
        const eloChanges = new Map<number, number>();

        const homeTeam = this.game.getHomeTeam();
        const awayTeam = this.game.getAwayTeam();

        // Calculate blended shares for all players
        const homeShares = this.calculateTeamShares(homeTeam);
        const awayShares = this.calculateTeamShares(awayTeam);

        // Calculate total shares
        const totalHomeShares = homeShares.reduce((sum, share) => sum + share, 0);
        const totalAwayShares = awayShares.reduce((sum, share) => sum + share, 0);

        // Calculate ELO changes for home team
        console.log("Home Team ELO Change")
        for (let i = 0; i < EloParameters.TEAM_SIZE; i++) {
            const player = homeTeam.players[i];
            console.log("Player: ", player.name)
            const blendedShare = homeShares[i];
            console.log("   blended share: ", blendedShare);
            const eloChange = this.calculatePlayerEloChange(player, blendedShare, totalHomeShares, homeTeam, awayTeam);
            eloChanges.set(player.playerId, eloChange);
        }

        // Calculate ELO changes for away team
        for (let i = 0; i < EloParameters.TEAM_SIZE; i++) {
            const player = awayTeam.players[i];
            const blendedShare = awayShares[i];
            const eloChange = this.calculatePlayerEloChange(player, blendedShare, totalAwayShares, awayTeam, homeTeam);
            eloChanges.set(player.playerId, eloChange);
        }

        return eloChanges;
    }

    /**
     *
     * @param team
     * @private
     *
     * This method computes the shares of the pot for each player in a team
     */
    private calculateTeamShares(team: Team): number[] {
        const shares: number[] = [];
        for (const player of team.players) {
            const playerEloShare = player.effectiveElo / team.effectiveTotalElo;
            const individualShare = player.getDecisiveness(this.game) * playerEloShare;
            const blendedShare = player.qFactor * individualShare + (1 - player.qFactor) * playerEloShare;
            shares.push(blendedShare);
        }
        return shares;
    }

    private calculatePlayerEloChange(
        player: Player,
        blendedShare: number,
        totalTeammateShares: number,
        playerTeam: Team,
        opponentTeam: Team
    ): number {
        const playerWon = this.game.didPlayerWin(player);
        const scalingFactor = this.eloPot / totalTeammateShares;
        if (this.result === GameResult.DRAW) {
            const expectedScore = this.getExpectedScore(playerTeam.effectiveAverageElo, opponentTeam.effectiveAverageElo);
            const drawSign = expectedScore < EloParameters.DRAW_SCORE ? 1 : (expectedScore > EloParameters.DRAW_SCORE ? -1 : 0);
            return Math.round(scalingFactor * blendedShare * drawSign);
        } else if (playerWon) {
            return Math.round(scalingFactor * blendedShare);
        } else {
            return -Math.round(scalingFactor * blendedShare);
        }
    }

    private getExpectedScore(playerElo: number, opponentElo: number): number {
        const diff = opponentElo - playerElo;
        return 1 / (1 + Math.pow(10, diff / EloParameters.ELO_DIFF_DIVISOR));
    }
}