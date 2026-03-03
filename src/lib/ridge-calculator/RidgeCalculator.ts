import { ridgeRegression } from './MatrixOperations';
import { RidgeParameters } from './RidgeParameters';

/**
 * Game data interface for ridge regression calculation
 */
export interface GameData {
  id: number;
  homePlayerIds: number[];
  awayPlayerIds: number[];
  homeGoals: number;
  awayGoals: number;
  homeGoalkeeperIds: number[];
  awayGoalkeeperIds: number[];
}

/**
 * Player rating data including both outfield and goalkeeper ratings
 */
export interface PlayerRatingData {
  playerId: number;
  elo: number;  // Outfield rating
  gkElo: number;  // Goalkeeper rating
  outfieldGames: number;
  gkGames: number;
}

/**
 * Ridge regression calculator for player ratings
 * Computes ratings by solving ridge regression on game history
 */
export class RidgeCalculator {
  private games: GameData[];
  private outfieldCoefficients: Map<number, number> = new Map();
  private gkCoefficients: Map<number, number> = new Map();
  private outfieldNormalized: Map<number, number> = new Map();
  private gkNormalized: Map<number, number> = new Map();
  private playerOutfieldGames: Map<number, number> = new Map();
  private playerGkGames: Map<number, number> = new Map();

  constructor(games: GameData[]) {
    this.games = games;
    this.computeRatings();
  }

  /**
   * Main computation method - trains both outfield and GK models
   */
  private computeRatings(): void {
    // Train outfield model
    const outfieldResult = this.buildDesignMatrix('outfield');
    if (outfieldResult.X.length > 0 && outfieldResult.playerIds.length > 0) {
      const coefficients = ridgeRegression(
        outfieldResult.X,
        outfieldResult.y,
        RidgeParameters.LAMBDA
      );

      // Store raw coefficients
      for (let i = 0; i < outfieldResult.playerIds.length; i++) {
        this.outfieldCoefficients.set(outfieldResult.playerIds[i], coefficients[i]);
      }

      // Normalize to ELO scale
      this.outfieldNormalized = this.normalizeCoefficients(
        coefficients,
        outfieldResult.playerIds
      );
    }

    // Train goalkeeper model
    const gkResult = this.buildDesignMatrix('goalkeeper');
    if (gkResult.X.length > 0 && gkResult.playerIds.length > 0) {
      const coefficients = ridgeRegression(
        gkResult.X,
        gkResult.y,
        RidgeParameters.LAMBDA
      );

      // Store raw coefficients
      for (let i = 0; i < gkResult.playerIds.length; i++) {
        this.gkCoefficients.set(gkResult.playerIds[i], coefficients[i]);
      }

      // Normalize to ELO scale
      this.gkNormalized = this.normalizeCoefficients(
        coefficients,
        gkResult.playerIds
      );
    }
  }

  /**
   * Builds design matrix for ridge regression
   * X[i][j] = +1 if player j on home team, -1 if on away team, 0 otherwise
   * y[i] = goal difference (homeGoals - awayGoals)
   *
   * @param positionFilter - 'outfield' or 'goalkeeper'
   * @returns Design matrix, target vector, and player IDs
   */
  private buildDesignMatrix(positionFilter: 'outfield' | 'goalkeeper'): {
    X: number[][];
    y: number[];
    playerIds: number[];
  } {
    // Collect unique player IDs who played in this position
    const playerIdSet = new Set<number>();

    for (const game of this.games) {
      if (positionFilter === 'outfield') {
        // Outfield: players NOT in goalkeeper list
        game.homePlayerIds.forEach(id => {
          if (!game.homeGoalkeeperIds.includes(id)) {
            playerIdSet.add(id);
            this.playerOutfieldGames.set(id, (this.playerOutfieldGames.get(id) || 0) + 1);
          }
        });
        game.awayPlayerIds.forEach(id => {
          if (!game.awayGoalkeeperIds.includes(id)) {
            playerIdSet.add(id);
            this.playerOutfieldGames.set(id, (this.playerOutfieldGames.get(id) || 0) + 1);
          }
        });
      } else {
        // Goalkeeper: players IN goalkeeper list
        game.homeGoalkeeperIds.forEach(id => {
          playerIdSet.add(id);
          this.playerGkGames.set(id, (this.playerGkGames.get(id) || 0) + 1);
        });
        game.awayGoalkeeperIds.forEach(id => {
          playerIdSet.add(id);
          this.playerGkGames.set(id, (this.playerGkGames.get(id) || 0) + 1);
        });
      }
    }

    const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
    const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

    // Build design matrix
    const X: number[][] = [];
    const y: number[] = [];

    for (const game of this.games) {
      const row = Array(playerIds.length).fill(0);

      if (positionFilter === 'outfield') {
        // Add outfield players
        game.homePlayerIds.forEach(id => {
          if (!game.homeGoalkeeperIds.includes(id)) {
            const idx = playerIdToIndex.get(id);
            if (idx !== undefined) {
              row[idx] = 1;
            }
          }
        });
        game.awayPlayerIds.forEach(id => {
          if (!game.awayGoalkeeperIds.includes(id)) {
            const idx = playerIdToIndex.get(id);
            if (idx !== undefined) {
              row[idx] = -1;
            }
          }
        });
      } else {
        // Add goalkeepers
        game.homeGoalkeeperIds.forEach(id => {
          const idx = playerIdToIndex.get(id);
          if (idx !== undefined) {
            row[idx] = 1;
          }
        });
        game.awayGoalkeeperIds.forEach(id => {
          const idx = playerIdToIndex.get(id);
          if (idx !== undefined) {
            row[idx] = -1;
          }
        });
      }

      // Only include game if there are players of this type
      if (row.some(val => val !== 0)) {
        X.push(row);
        y.push(game.homeGoals - game.awayGoals);
      }
    }

    return { X, y, playerIds };
  }

  /**
   * Normalizes raw coefficients to ELO scale (mean=1500, std matching distribution)
   *
   * @param coefficients - Raw ridge regression coefficients
   * @param playerIds - Corresponding player IDs
   * @returns Map of player ID to normalized ELO-like rating
   */
  private normalizeCoefficients(
    coefficients: number[],
    playerIds: number[]
  ): Map<number, number> {
    const normalized = new Map<number, number>();

    if (coefficients.length === 0) {
      return normalized;
    }

    // Calculate mean and std dev of coefficients
    const mean = coefficients.reduce((a, b) => a + b, 0) / coefficients.length;
    const variance =
      coefficients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      coefficients.length;
    const std = Math.sqrt(variance);

    // Use default std dev if calculated is too small
    const targetStd = std > 0.01 ? RidgeParameters.DEFAULT_STD_DEV : RidgeParameters.DEFAULT_STD_DEV;

    // Normalize each coefficient to ELO scale
    for (let i = 0; i < coefficients.length; i++) {
      const playerId = playerIds[i];
      let normalizedValue: number;

      if (std > 0.01) {
        // Standard normalization
        normalizedValue =
          RidgeParameters.NORMALIZED_MEAN +
          ((coefficients[i] - mean) / std) * targetStd;
      } else {
        // All coefficients are similar, default to mean
        normalizedValue = RidgeParameters.NORMALIZED_MEAN;
      }

      normalized.set(playerId, Math.round(normalizedValue));
    }

    return normalized;
  }

  /**
   * Returns player ratings for all players
   * @returns Map of player ID to rating data
   */
  public getPlayerRatings(): Map<number, PlayerRatingData> {
    const ratings = new Map<number, PlayerRatingData>();

    // Combine all unique player IDs
    const allPlayerIds = new Set([
      ...this.outfieldNormalized.keys(),
      ...this.gkNormalized.keys(),
    ]);

    for (const playerId of allPlayerIds) {
      const outfieldGames = this.playerOutfieldGames.get(playerId) || 0;
      const gkGames = this.playerGkGames.get(playerId) || 0;

      // Get ratings or default to NORMALIZED_MEAN
      let elo: number;
      let gkElo: number;

      if (outfieldGames >= RidgeParameters.MIN_GAMES_FOR_RATING) {
        elo = this.outfieldNormalized.get(playerId) || RidgeParameters.NORMALIZED_MEAN;
      } else {
        elo = RidgeParameters.NORMALIZED_MEAN;
      }

      if (gkGames >= RidgeParameters.MIN_GAMES_FOR_RATING) {
        gkElo = this.gkNormalized.get(playerId) || RidgeParameters.NORMALIZED_MEAN;
      } else {
        gkElo = RidgeParameters.NORMALIZED_MEAN;
      }

      ratings.set(playerId, {
        playerId,
        elo,
        gkElo,
        outfieldGames,
        gkGames,
      });
    }

    return ratings;
  }

  /**
   * Predicts expected goal difference for a matchup
   * @param homePlayerIds - Player IDs on home team
   * @param awayPlayerIds - Player IDs on away team
   * @param homeIsGk - Map of player ID to whether they're playing GK on home team
   * @param awayIsGk - Map of player ID to whether they're playing GK on away team
   * @returns Expected goal difference (positive = home favored)
   */
  public predictGame(
    homePlayerIds: number[],
    awayPlayerIds: number[],
    homeIsGk: Map<number, boolean> = new Map(),
    awayIsGk: Map<number, boolean> = new Map()
  ): number {
    let homeStrength = 0;
    let awayStrength = 0;

    // Calculate home team strength
    for (const playerId of homePlayerIds) {
      const isGk = homeIsGk.get(playerId) || false;
      const coeff = isGk
        ? (this.gkCoefficients.get(playerId) || 0)
        : (this.outfieldCoefficients.get(playerId) || 0);
      homeStrength += coeff;
    }

    // Calculate away team strength
    for (const playerId of awayPlayerIds) {
      const isGk = awayIsGk.get(playerId) || false;
      const coeff = isGk
        ? (this.gkCoefficients.get(playerId) || 0)
        : (this.outfieldCoefficients.get(playerId) || 0);
      awayStrength += coeff;
    }

    return homeStrength - awayStrength;
  }
}
