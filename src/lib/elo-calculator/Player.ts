import {EloParameters} from "@/lib/elo-calculator/EloParameters";
import {Game} from "./Game";

export class Player {


    public playerId : number; // player id as in the database
    public goalsScored : number;
    public name : string; // used to debug or have tests, easier to read. not necessary for ELO computation.
    public effectiveElo : number;
    public qFactor : number;


    private gamesPlayed;
    public elo : number;
    private gamesInARow : number;

    public constructor(playerId : number, name : string, goalsScored : number, gamesInARow : number, elo : number, gamesPlayed : number) {

        this.playerId = playerId;
        this.gamesInARow = gamesInARow;
        this.name = name;
        this.goalsScored = goalsScored;
        this.gamesPlayed = gamesPlayed;
        this.elo = elo;

        this.effectiveElo = elo * this.getFatigue();
        this.qFactor = this.getQFactor();
    }


    public getDecisiveness(game : Game): number {
        const playerGoals = this.goalsScored;
        const playerTeamWon = game.didPlayerWin(this);

        // Find which team the player is on
        const homeTeam = game.getHomeTeam();
        const awayTeam = game.getAwayTeam();
        const isHomeTeam = homeTeam.players.some(p => p.playerId === this.playerId);

        const playerTeam = isHomeTeam ? homeTeam : awayTeam;
        const opponentTeam = isHomeTeam ? awayTeam : homeTeam;

        const playerTeamTotalGoals = playerTeam.getGoalsScored();
        const opponentTeamGoals = opponentTeam.getGoalsScored();
        const playerTeamTotalGoalsWithoutPlayer = playerTeamTotalGoals - this.goalsScored;

        if (playerGoals === 0) {
            return playerTeamWon ? EloParameters.NO_GOALS_WINNER_DECISIVENESS : EloParameters.NO_GOALS_LOSER_DECISIVENESS;
        }

        const resultWithoutPlayer = playerTeamTotalGoalsWithoutPlayer - opponentTeamGoals;
        const resultWithPlayer = playerTeamTotalGoals - opponentTeamGoals;

        const goalContribution = playerGoals;
        const scaledGoalContribution = Math.cbrt(goalContribution + 1);

        if (resultWithoutPlayer < 0 && resultWithPlayer >= 0) {
            return EloParameters.CLUTCH_LOSS_TO_WIN_MULTIPLIER * scaledGoalContribution;
        } else if (resultWithoutPlayer === 0 && resultWithPlayer > 0) {
            return EloParameters.CLUTCH_DRAW_TO_WIN_MULTIPLIER * scaledGoalContribution;
        } else if (resultWithoutPlayer > 0 && resultWithPlayer > resultWithoutPlayer) {
            return EloParameters.CLUTCH_WIN_IMPROVEMENT_MULTIPLIER * scaledGoalContribution;
        } else if (playerTeamWon && playerGoals === playerTeamTotalGoals) {
            return EloParameters.SOLO_SCORER_MULTIPLIER * scaledGoalContribution;
        } else {
            return scaledGoalContribution;
        }
    }

    private getFatigue(): number {
        if (this.gamesInARow <= EloParameters.MIN_GAMES_FOR_FATIGUE) return EloParameters.NO_FATIGUE_MULTIPLIER;
        const fatigue = (this.gamesInARow - 1) * EloParameters.FATIGUE_COEFFICIENT;
        return 1 - Math.min(1, fatigue);
    }

    private getQFactor(): number {
        return Math.max(EloParameters.MIN_Q_FACTOR, 1.0 - this.gamesPlayed * EloParameters.EXPERIENCE_WEIGHT);
    }

    public toString(): string {
        return `Player{id=${this.playerId}, name="${this.name}", elo=${this.elo}, effectiveElo=${this.effectiveElo.toFixed(1)}, goals=${this.goalsScored}, gamesPlayed=${this.gamesPlayed}, qFactor=${this.qFactor.toFixed(2)}}`;
    }

}