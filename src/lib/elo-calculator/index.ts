import {Player} from "./Player";
import {Team} from "./Team";
import {Game} from "./Game";
import {EloCalculator} from "./EloCalculator";

interface PlayerData {
    playerId: number;
    name?: string;
    elo: number;
    goals: number;
    gamesPlayed: number;
    fatigueX: number; // Fatigue in minutes: increases by game duration, decreases by 1 per minute not playing
    isGoalKeeper?: boolean;
}

/**
 * Calculate ELO changes for all players in a game.
 *
 * @param homeTeamPlayers - Array of player data for the home team
 * @param awayTeamPlayers - Array of player data for the away team
 * @param homeGoalKeeperId - Optional goalkeeper player ID for home team
 * @param awayGoalKeeperId - Optional goalkeeper player ID for away team
 * @returns Map of playerId to ELO change (positive for gain, negative for loss)
 */
export function calculateGameElos(
    homeTeamPlayers: PlayerData[],
    awayTeamPlayers: PlayerData[],
    homeGoalKeeperId?: number,
    awayGoalKeeperId?: number
): Map<number, number> {
    // Create Player instances for home team
    const homePlayers = homeTeamPlayers.map(
        (p) => new Player(p.playerId, p.name ?? `Player ${p.playerId}`, p.fatigueX, p.gamesPlayed, p.elo)
    );

    // Create Player instances for away team
    const awayPlayers = awayTeamPlayers.map(
        (p) => new Player(p.playerId, p.name ?? `Player ${p.playerId}`, p.fatigueX, p.gamesPlayed, p.elo)
    );

    // Determine goalkeeper IDs (use -1 if not specified, meaning no goalkeeper bonus)
    const homeGkId = homeGoalKeeperId ?? homeTeamPlayers.find(p => p.isGoalKeeper)?.playerId ?? -1;
    const awayGkId = awayGoalKeeperId ?? awayTeamPlayers.find(p => p.isGoalKeeper)?.playerId ?? -1;

    // Create Team instances
    const homeTeam = new Team(homePlayers, homeGkId);
    const awayTeam = new Team(awayPlayers, awayGkId);

    // Create player goals map
    const playerGoals = new Map<Player, number>();
    homeTeamPlayers.forEach((p, i) => {
        playerGoals.set(homePlayers[i], p.goals);
    });
    awayTeamPlayers.forEach((p, i) => {
        playerGoals.set(awayPlayers[i], p.goals);
    });

    // Create Game instance
    const game = new Game(homeTeam, awayTeam, playerGoals);

    // Create EloCalculator and get ELO changes
    const calculator = new EloCalculator(game);
    const playerEloChanges = calculator.getPlayerEloChanges();

    // Convert to Map<playerId, eloChange>
    const result = new Map<number, number>();
    for (const [player, eloChange] of playerEloChanges) {
        result.set(player.playerId, eloChange);
    }

    return result;
}

// Export the classes for direct use if needed
export { Player, Team, Game, EloCalculator };
export { EloParameters } from "./EloParameters";
