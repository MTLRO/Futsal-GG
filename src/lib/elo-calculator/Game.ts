import {Team} from "./Team"
import {Player} from "./Player"
import {EloParameters} from "./EloParameters"

export enum GameResult {
    DRAW, HOME_WIN, AWAY_WIN
}


export class Game {
        private homeTeam : Team;
        private awayTeam : Team;
        private eloPot : number;
        private result : GameResult;
        private length : number;

        constructor(homeTeam : Team, awayTeam : Team, length : number) {
            this.homeTeam = homeTeam;
            this.awayTeam  = awayTeam;
            this.length  = length;
            this.result = this.getGameResult();
            this.eloPot = this.getELOPot();
        }

        public didPlayerWin(player : Player) : boolean {
            const isHomeTeam = this.homeTeam.players.some(p => p.playerId === player.playerId);
            return (isHomeTeam && this.result === GameResult.HOME_WIN) ||
                   (!isHomeTeam && this.result === GameResult.AWAY_WIN);
        }

        private getGameResult() : GameResult {
            if (this.homeTeam.getGoalsScored() === this.awayTeam.getGoalsScored()) {
                return GameResult.DRAW;
            } else if (this.homeTeam.getGoalsScored() > this.awayTeam.getGoalsScored()) {
                return GameResult.HOME_WIN
            }
            return GameResult.AWAY_WIN;
        }

        private getELOPot() : number {
            const homeEffectiveElo = this.homeTeam.effectiveAverageElo;
            const awayEffectiveElo = this.awayTeam.effectiveAverageElo;
            // Get expected score based on effective ELO difference
            const expectedScore = this.getExpectedScore(homeEffectiveElo, awayEffectiveElo);
            console.log("expectedScore: ", expectedScore);
            // Actual score: 0.5 for draw, 1 for home win, 0 for away win
            const homeActualScore = this.result === GameResult.DRAW ? EloParameters.DRAW_SCORE :
                                   (this.result === GameResult.HOME_WIN ? EloParameters.WIN_SCORE : EloParameters.LOSS_SCORE);
            console.log("actual score: ", homeActualScore);
            // Calculate goal differential multiplier
            const goalDiff = Math.abs(this.homeTeam.getGoalsScored() - this.awayTeam.getGoalsScored());
            const goalMultiplier = this.getGoalDifferentialMultiplier(goalDiff);
            console.log("goal multiplier: ", goalMultiplier)
            // Get average K-factor from home team
            const avgHomeK = this.homeTeam.players.reduce((sum, p) => sum + this.getKFactor(p.effectiveElo), 0) / EloParameters.TEAM_SIZE;
            console.log("avg home K: ", avgHomeK);
            if (this.result === GameResult.DRAW) {
                return avgHomeK * EloParameters.DRAW_SCORE * goalMultiplier;
            } else {
                return Math.abs(avgHomeK * (homeActualScore - expectedScore) * goalMultiplier);
            }
        }

        private getExpectedScore(playerElo: number, opponentElo: number): number {
            const diff = opponentElo - playerElo;
            return 1 / (1 + Math.pow(10, diff / EloParameters.ELO_DIFF_DIVISOR));
        }

        private getGoalDifferentialMultiplier(goalDiff: number): number {
            if (this.result === GameResult.DRAW) return EloParameters.DRAW_GOAL_MULTIPLIER;
            return Math.cbrt(goalDiff + 1);
        }

        private getKFactor(elo: number): number {
            if (elo > EloParameters.K_FACTOR_HIGH_THRESHOLD) return EloParameters.K_FACTOR_HIGH;
            if (elo > EloParameters.K_FACTOR_MID_THRESHOLD) return EloParameters.K_FACTOR_MID;
            return EloParameters.K_FACTOR_LOW;
        }

        // Public getters for EloCalculator
        public getHomeTeam(): Team {
            return this.homeTeam;
        }

        public getAwayTeam(): Team {
            return this.awayTeam;
        }

        public getResult(): GameResult {
            return this.result;
        }

        public getEloPot(): number {
            return this.eloPot;
        }

        public toString(): string {
            const homeGoals = this.homeTeam.getGoalsScored();
            const awayGoals = this.awayTeam.getGoalsScored();
            let resultStr = "";

            if (this.result === GameResult.DRAW) {
                resultStr = "DRAW";
            } else if (this.result === GameResult.HOME_WIN) {
                resultStr = "HOME_WIN";
            } else {
                resultStr = "AWAY_WIN";
            }

            return `Game{result=${resultStr}, score=${homeGoals}-${awayGoals}, eloPot=${this.eloPot.toFixed(1)}, homeAvgElo=${this.homeTeam.effectiveAverageElo.toFixed(1)}, awayAvgElo=${this.awayTeam.effectiveAverageElo.toFixed(1)}}`;
        }
}