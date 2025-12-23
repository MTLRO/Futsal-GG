import {EloParameters} from "@/lib/elo-calculator/EloParameters";
import {Game} from "./Game";
import { Result } from "./Result";

export interface ChemistryData {
    playerId: number;
    wins: number;
    losses: number;
    draws: number;
}

export class Player {


    public playerId : number; // player id as in the database
    public name : string; // used to debug or have tests, easier to read. not necessary for ELO computation.

    public qFactor : number; // computed
    public elo : number; // computed, takes into consideration the fatigue and chemistry of the player.

    //Data from the DB.
    private staticElo : number;
    private fatigueX : number;
    private gamesPlayed : number = 0;
    private teammatesChemistry : ChemistryData[]; // Chemistry data with current teammates



    public constructor(playerId : number, name : string, fatigueX : number, gamesPlayed : number, staticElo : number, teammatesChemistry : ChemistryData[] = []
    ) {
        this.playerId = playerId;
        this.name = name;
        this.staticElo = staticElo;
        this.fatigueX = fatigueX; // [0,1]
        this.gamesPlayed = gamesPlayed;
        this.teammatesChemistry = teammatesChemistry;

        this.qFactor = this.getQFactor();
        this.elo = this.staticElo * this.getFatigueCoefficient() * this.getChemistryCoefficient();
    }

    public getGoalsScoredInGame(game : Game) : number {
        return game.getPlayerGoals(this);
    }

    public getDecisivenessMultiplier(goalsScoredByThis : number, goalsScoredByTeamates : number, goalsScoredByOpponents : number, goalKeeper : boolean) : number {
        let goalBonus = 1.0;

        // we increase this value depending on the player "decisiveness"
        let output = 1.0;



        if (goalKeeper) {
            if (goalsScoredByOpponents === 0) {
                output += EloParameters.CLEAN_SHEET_BONUS;
            }
            if (goalsScoredByOpponents === 1) {
                output += EloParameters.ONE_GOAL_ALLOWED_BONUS;
            }
            if (goalsScoredByOpponents === 2) {
                output += EloParameters.TWO_GOALS_ALLOWED_BONUS;
            }
            goalBonus = EloParameters.GK_GOAL_COEF;
        }

        // win = 1, draw = 0.5, loss = 0
        const resultWithoutPlayer = goalsScoredByTeamates - goalsScoredByOpponents > 0 ? Result.WIN : (goalsScoredByTeamates - goalsScoredByOpponents < 0 ? Result.LOSS : Result.DRAW);
        const resultWithPlayer = (goalsScoredByThis + goalsScoredByTeamates) - goalsScoredByOpponents > 0 ? Result.WIN : ((goalsScoredByThis +goalsScoredByTeamates) - goalsScoredByOpponents < 0 ? Result.LOSS : Result.DRAW);

        // Clutch factor
        if (resultWithoutPlayer === Result.LOSS && resultWithPlayer === Result.WIN) {
            // Player turned a loss into a win
            output += EloParameters.LOSS_TO_WIN;
        } else
        if (resultWithoutPlayer === Result.LOSS && resultWithPlayer === Result.DRAW) {
            // Player turned a loss into a tie
            output += EloParameters.LOSS_TO_TIE;
        } else
        if (resultWithoutPlayer === Result.DRAW && resultWithPlayer === Result.WIN) {
            // Player turned a tie into a win
            output += EloParameters.TIE_TO_WIN;
        } else {
            // No significant impact
        }


        // Goal factor, applies regardless, even if player didnt change the result.
        // On losses, goals provide strong protection (3x bonus) vs wins
        const isLoss = (resultWithoutPlayer === Result.LOSS && resultWithPlayer === Result.LOSS);
        const goalMultiplier = isLoss ? 3.0 : 1.0; // On losses, 3x goal bonus for protection

        if (goalsScoredByThis === 1) {
            output += EloParameters.SINGLE_GOAL_BONUS * goalBonus * goalMultiplier;
        } else if (goalsScoredByThis === 2) {
            output += EloParameters.DOUBLE_GOAL_BONUS * goalBonus * goalMultiplier;
        } else if (goalsScoredByThis >= 3) {
            output += (Math.cbrt(goalsScoredByThis + 1)/5 + 0.4) * goalBonus * goalMultiplier;
        }

        return output;
    }

    private getFatigueCoefficient(): number {
        return Math.min(1, (this.fatigueX / 20) ** 2);
    }

    /**
     * Calculates the chemistry coefficient based on this player's history with their teammates.
     * Chemistry is based on win rate with each teammate, weighted by number of games together.
     *
     * Returns a multiplier between CHEMISTRY_MIN_COEFFICIENT (0.85) and CHEMISTRY_MAX_COEFFICIENT (1.15):
     * - Players who consistently win together get a bonus (up to +15%)
     * - Players who consistently lose together get a penalty (up to -15%)
     * - Players who never played together get a slight penalty (neutral - 2%)
     * - More games together = higher confidence in the chemistry score
     */
    private getChemistryCoefficient(): number {
        // If no teammates data provided (shouldn't happen in normal operation)
        if (!this.teammatesChemistry || this.teammatesChemistry.length === 0) {
            return 1.0; // Neutral coefficient
        }

        let totalChemistry = 0;
        let teammateCount = 0;

        for (const teammate of this.teammatesChemistry) {
            const totalGames = teammate.wins + teammate.losses + teammate.draws;

            let chemistry: number;
            if (totalGames === 0) {
                // Never played together - use neutral default (slight penalty)
                chemistry = EloParameters.CHEMISTRY_NEUTRAL;
            } else {
                // Calculate win rate: wins count as 1, draws as 0.5
                const winRate = (teammate.wins + 0.5 * teammate.draws) / totalGames;

                // Calculate confidence based on games played together
                const confidence = Math.min(1, totalGames / EloParameters.GAMES_FOR_FULL_CONFIDENCE);

                // Blend actual win rate with neutral default based on confidence
                // Low confidence = closer to neutral, high confidence = closer to actual win rate
                chemistry = confidence * winRate + (1 - confidence) * EloParameters.CHEMISTRY_NEUTRAL;
            }

            totalChemistry += chemistry;
            teammateCount++;
        }

        // Calculate average chemistry across all teammates
        const avgChemistry = teammateCount > 0 ? totalChemistry / teammateCount : 0.5;

        // Map chemistry score (0 to 1) to coefficient range
        // 0.0 chemistry → MIN_COEFFICIENT (0.85)
        // 0.5 chemistry → 1.0 (neutral)
        // 1.0 chemistry → MAX_COEFFICIENT (1.15)
        const coefficientRange = EloParameters.CHEMISTRY_MAX_COEFFICIENT - EloParameters.CHEMISTRY_MIN_COEFFICIENT;
        const chemistryCoefficient = EloParameters.CHEMISTRY_MIN_COEFFICIENT + (coefficientRange * avgChemistry);

        return chemistryCoefficient;
    }



    private getQFactor(): number {
        return Math.max(EloParameters.MIN_Q_FACTOR, 1.0 - this.gamesPlayed * EloParameters.EXPERIENCE_WEIGHT);
    }

    public getKFactor(): number {
        if (this.staticElo >= EloParameters.K_FACTOR_HIGH_THRESHOLD) {
            return EloParameters.K_FACTOR_HIGH;
        } else if (this.staticElo >= EloParameters.K_FACTOR_MID_THRESHOLD) {
            return EloParameters.K_FACTOR_MID;
        } else {
            return EloParameters.K_FACTOR_LOW;
        }
    }

    public getStaticElo(): number {
        return this.staticElo;
    }

    public toString(): string {
        return `Player{id=${this.playerId}, name="${this.name}", staticElo=${this.staticElo}, elo=${this.elo.toFixed(1)}, gamesPlayed=${this.gamesPlayed}, qFactor=${this.qFactor.toFixed(2)}}`;
    }

}