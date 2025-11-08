import {Player} from "./Player"
import {EloParameters} from "./EloParameters"

export class Team {

    public players: Player[];
    private actualAverageElo : number;
    public effectiveAverageElo : number;
    public effectiveTotalElo : number;

    constructor(players: Player[]) {
        if (players.length != EloParameters.TEAM_SIZE) throw new Error(`Need ${EloParameters.TEAM_SIZE} players.`);
        this.players = players;
        this.actualAverageElo = this.players.reduce((sum, p) => sum + p.elo, 0) / EloParameters.TEAM_SIZE;
        this.effectiveTotalElo = this.players.reduce((sum, p) => sum + p.effectiveElo, 0);
        this.effectiveAverageElo = this.effectiveTotalElo / EloParameters.TEAM_SIZE;
        console.log("actual elo of team: ", this.actualAverageElo);
        console.log("effective elo of team: ", this.effectiveAverageElo);
    }

    public getGoalsScored() : number {
        return this.players.reduce((sum, p) => sum + p.goalsScored, 0);
    }

    public toString(): string {
        const playerNames = this.players.map(p => p.name).join(", ");
        return `Team{players=[${playerNames}], avgElo=${this.actualAverageElo.toFixed(1)}, effectiveAvgElo=${this.effectiveAverageElo.toFixed(1)}, goals=${this.getGoalsScored()}}`;
    }

}