/**
 * Configuration parameters for ridge regression rating system
 */
export class RidgeParameters {
  /**
   * L2 regularization parameter (lambda)
   * Higher values = smoother ratings, less overfitting
   * Optimal value determined from testing: 1.0 achieves ~60% accuracy
   */
  public static readonly LAMBDA = 1.0;

  /**
   * Target mean for normalized coefficients
   * Standard ELO scale centers at 1500
   */
  public static readonly NORMALIZED_MEAN = 1500;

  /**
   * Minimum games required to have a reliable rating
   * Players with fewer games get defaulted to NORMALIZED_MEAN
   */
  public static readonly MIN_GAMES_FOR_RATING = 3;

  /**
   * Default standard deviation for normalization
   * Used when there's insufficient data to calculate actual std dev
   */
  public static readonly DEFAULT_STD_DEV = 200;
}
