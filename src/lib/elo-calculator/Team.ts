import {Player} from "./Player"
import {EloParameters} from "./EloParameters"

export class Team {

    public players: Player[];
    public elo : number;
    public goalKeeperId : number;


    constructor(players: Player[], goalKeeperId: number) {
        if (players.length != EloParameters.TEAM_SIZE) throw new Error(`Need ${EloParameters.TEAM_SIZE} players.`);
        this.players = players;
        this.elo = players.reduce((sum, p) => sum + p.elo, 0);
        this.goalKeeperId = goalKeeperId;
    }

    public getAverageElo(): number {
        return this.elo / this.players.length;
    }

    public isGoalKeeper(player: Player): boolean {
        return player.playerId === this.goalKeeperId;
    }

    public toString(): string {
        return `Team{elo=${this.elo}, players=[${this.players.map(p => p.toString()).join(", ")}]}`;
    }

}