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

    private findTeam(game: Game) {
        const homeTeam = game.getHomeTeam();
        const awayTeam = game.getAwayTeam();

        return homeTeam.players.some(p => p.playerId === this.playerId)
            ? homeTeam
            : awayTeam;
    }

    public getDecisiveness(game: Game): number {
        const playerGoals = this.goalsScored;

        const team = this.findTeam(game);
        const opponentTeam = team === game.getHomeTeam()
            ? game.getAwayTeam()
            : game.getHomeTeam();

        const teammatesGoals = team.getGoalsScored() - playerGoals;
        const opponentGoals = opponentTeam.getGoalsScored();


        // Determine result swing without the player
        const resultWithoutPlayer = teammatesGoals - opponentGoals;
        const resultWithPlayer = team.getGoalsScored() - opponentGoals;

        const playerWon = game.didPlayerWin(this);
        const teamGoals = team.getGoalsScored();
        const isDraw = teamGoals === opponentGoals;

        let multiplier: number;

        if (resultWithoutPlayer < 0 && resultWithPlayer > 0) {
            // Player turned a loss into a win
            multiplier = EloParameters.LOSS_TO_WIN;
        } else if (resultWithoutPlayer < 0 && resultWithPlayer === 0) {
            // Player turned a loss into a tie
            multiplier = EloParameters.LOSS_TO_TIE;
        } else if (resultWithoutPlayer === 0 && resultWithPlayer > 0) {
            // Player turned a tie into a win
            multiplier = EloParameters.TIE_TO_WIN;
        } else {
            // No significant impact
            multiplier = EloParameters.NO_IMPACT;
        }

        // Final decisiveness formula
        let decisiveness: number;

        if (!playerWon && !isDraw) {
            // Player's team lost (not a draw)
            const impact = opponentGoals - teammatesGoals;
            decisiveness = Math.max(EloParameters.NO_IMPACT, Math.sqrt((playerGoals + 1) * impact));
        } else {
            // Win or draw - use square root for more pronounced differences
            // Higher formula values = more impact = more ELO when winning, less loss when losing
            decisiveness = Math.sqrt((playerGoals + 1 + opponentGoals) / (teammatesGoals + 1)) * multiplier;
        }

        // Defensive bonus for non-scorers when team didn't concede much
        if (playerGoals === 0 && (playerWon || isDraw)) {
            let defensiveBonus = 0;

            if (opponentGoals === 0) {
                // Clean sheet - strong defensive contribution
                defensiveBonus = 0.9;
            } else if (opponentGoals === 1) {
                // Conceded only 1 goal - good defensive contribution
                defensiveBonus = 0.55;
            } else if (opponentGoals === 2) {
                // Conceded 2 goals - moderate defensive contribution
                defensiveBonus = 0.2;
            }

            // Apply defensive bonus to bring decisiveness above NO_IMPACT
            decisiveness = Math.max(decisiveness, EloParameters.NO_IMPACT) + defensiveBonus;
        }

        return decisiveness;
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