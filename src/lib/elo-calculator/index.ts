import {Player} from "./Player";
import {Team} from "./Team";
import {Game} from "./Game";
import {EloCalculator} from "./EloCalculator";

interface PlayerData {
    playerId: number;
    elo: number;
    goals: number;
    gamesPlayed: number;
    gameInARow: number;
}

/**
 * Calculate ELO changes for all players in a game.
 * This is a wrapper function that maintains backward compatibility with the existing API
 * while using the new class-based architecture internally.
 *
 * @param homeTeamPlayers - Array of player data for the home team
 * @param awayTeamPlayers - Array of player data for the away team
 * @returns Map of playerId to ELO change (positive for gain, negative for loss)
 */
export function calculateGameElos(
    homeTeamPlayers: PlayerData[],
    awayTeamPlayers: PlayerData[]
): Map<number, number> {
    // Create Player instances for home team
    const homePlayers = homeTeamPlayers.map(
        (p) => new Player(p.playerId, `Player ${p.playerId}`, p.goals, p.gameInARow, p.elo, p.gamesPlayed)
    );

    // Create Player instances for away team
    const awayPlayers = awayTeamPlayers.map(
        (p) => new Player(p.playerId, `Player ${p.playerId}`, p.goals, p.gameInARow, p.elo, p.gamesPlayed)
    );

    // Create Team instances
    const homeTeam = new Team(homePlayers);
    const awayTeam = new Team(awayPlayers);

    // Create Game instance (length doesn't affect ELO calculation, using 0 as placeholder)
    const game = new Game(homeTeam, awayTeam, 0);

    // Create EloCalculator and calculate all ELO changes
    const calculator = new EloCalculator(game);

    return calculator.calculateGameElos();
}

// Export the classes for direct use if needed
export { Player, Team, Game, EloCalculator };
export { EloParameters } from "./EloParameters";
