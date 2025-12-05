import {Team} from "./Team"
import {Player} from "./Player"
import {EloParameters} from "./EloParameters"
import { Result } from "./Result";

export enum GameResult {
    DRAW, HOME_WIN, AWAY_WIN
}


export class Game {
        private team1 : Team;
        private team2 : Team;
        private playerGoals : Map<Player, number>; // player -> goals scored

        public result : Result;
        public winningTeam : Team | null;
        public losingTeam : Team | null;

        constructor(team1 : Team, team2 : Team, playerGoals : Map<Player, number>) {
            this.team1 = team1;
            this.team2 = team2;
            this.playerGoals = playerGoals;
            this.winningTeam = null;
            this.losingTeam = null;
            this.result = this.computeResult();
        }

        private computeResult() : Result {
            const team1Goals = this.getTeamGoals(this.team1);
            const team2Goals = this.getTeamGoals(this.team2);
            if (team1Goals > team2Goals) {
                this.winningTeam = this.team1;
                this.losingTeam = this.team2;
                return Result.WIN;
            } else if (team1Goals < team2Goals) {
                this.winningTeam = this.team2;
                this.losingTeam = this.team1;
                return Result.LOSS;
            } else {
                return Result.DRAW;
            }
        }

        public getTeam1(): Team {
            return this.team1;
        }

        public getTeam2(): Team {
            return this.team2;
        }

        public getTeamGoals(team: Team): number {
            let goals = 0;
            for (const player of team.players) {
                goals += this.getPlayerGoals(player);
            }
            return goals;
        }

        public getPlayerGoals(player: Player): number {
            return this.playerGoals.get(player) ?? 0;
        }

        public getOpponentTeam(team: Team): Team {
            return team === this.team1 ? this.team2 : this.team1;
        }

}