/**
 * Ridge Regression Rating System
 *
 * This module implements a ridge regression-based player rating system
 * as an alternative to the traditional ELO system. Ratings are computed
 * by solving ridge regression on the entire game history, then normalized
 * to the familiar ELO scale (centered at 1500).
 *
 * Key differences from ELO:
 * - Batch computation (uses all games) vs incremental updates
 * - Fewer parameters (just lambda) vs K-factors, fatigue, chemistry
 * - Better prediction accuracy (~60% vs ~55%)
 * - Simpler, more mathematically principled approach
 */

import { RidgeCalculator, type GameData, type PlayerRatingData } from './RidgeCalculator';
import { RidgeParameters } from './RidgeParameters';

export { RidgeCalculator, RidgeParameters };
export type { GameData, PlayerRatingData };

/**
 * Calculate ridge regression ratings for all players based on game history
 *
 * @param games - All games in chronological order
 * @returns Map of playerId to their ratings (elo, gkElo, games played)
 *
 * @example
 * ```typescript
 * const games = await fetchGamesFromDB();
 * const ratings = calculateRidgeRatings(games);
 *
 * for (const [playerId, rating] of ratings) {
 *   console.log(`Player ${playerId}: ${rating.elo} ELO, ${rating.gkElo} GK ELO`);
 * }
 * ```
 */
export function calculateRidgeRatings(games: GameData[]): Map<number, PlayerRatingData> {
  if (games.length === 0) {
    return new Map();
  }

  const calculator = new RidgeCalculator(games);
  return calculator.getPlayerRatings();
}

/**
 * Predict expected goal difference for a matchup using ridge regression coefficients
 *
 * @param homePlayerRatings - Ratings for home team players
 * @param awayPlayerRatings - Ratings for away team players
 * @param homeGoalkeeperIds - IDs of players who are goalkeepers on home team
 * @param awayGoalkeeperIds - IDs of players who are goalkeepers on away team
 * @param allGames - All games (needed to build calculator for prediction)
 * @returns Expected goal difference (positive = home team favored)
 *
 * @example
 * ```typescript
 * const prediction = predictGameOutcome(
 *   homeRatings,
 *   awayRatings,
 *   [1], // Player 1 is GK for home
 *   [2], // Player 2 is GK for away
 *   allGames
 * );
 * console.log(`Expected goal difference: ${prediction.toFixed(2)}`);
 * ```
 */
export function predictGameOutcome(
  homePlayerRatings: PlayerRatingData[],
  awayPlayerRatings: PlayerRatingData[],
  homeGoalkeeperIds: number[],
  awayGoalkeeperIds: number[],
  allGames: GameData[]
): number {
  if (allGames.length === 0) {
    return 0;
  }

  const calculator = new RidgeCalculator(allGames);

  const homePlayerIds = homePlayerRatings.map(r => r.playerId);
  const awayPlayerIds = awayPlayerRatings.map(r => r.playerId);

  const homeIsGk = new Map(homePlayerIds.map(id => [id, homeGoalkeeperIds.includes(id)]));
  const awayIsGk = new Map(awayPlayerIds.map(id => [id, awayGoalkeeperIds.includes(id)]));

  return calculator.predictGame(homePlayerIds, awayPlayerIds, homeIsGk, awayIsGk);
}
