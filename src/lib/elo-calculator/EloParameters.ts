export class EloParameters {
    // ============================================================================
    // Q-Factor (Experience-Based Blending)
    // ============================================================================

    /**
     * Controls how quickly players transition from individual performance-based
     * ELO distribution to team-based distribution as they gain experience.
     * Higher values = faster transition to team-based sharing.
     * Formula: qFactor = max(MIN_Q_FACTOR, 1.0 - gamesPlayed * EXPERIENCE_WEIGHT)
     * Example: With 0.01, a player reaches minimum q-factor after 50 games.
     */
    public static readonly EXPERIENCE_WEIGHT = 0.01;

    /**
     * The minimum q-factor value that experienced players converge to.
     * At this level, ELO distribution is 50% individual performance, 50% team share.
     * Range: 0.0 (100% team-based) to 1.0 (100% individual performance-based)
     * Current: 0.5 means veterans get half their share from performance, half from base ELO.
     */
    public static readonly MIN_Q_FACTOR = 0.5;

    // ============================================================================
    // Fatigue Calculation
    // ============================================================================

    /**
     * Controls how severely consecutive games reduce a player's effective ELO.
     * Higher values = more fatigue per consecutive game.
     * Formula: fatigue = (gamesInARow - 1) * FATIGUE_COEFFICIENT
     * Example: With 0.45, playing 3 games in a row = 90% fatigue (2 * 0.45)
     */
    public static readonly FATIGUE_COEFFICIENT = 0.05;

    /**
     * The minimum number of consecutive games before fatigue starts accumulating.
     * Players playing this many games or fewer have no fatigue penalty.
     * Current: 1 means fatigue starts on the 2nd consecutive game.
     */
    public static readonly MIN_GAMES_FOR_FATIGUE = 1;

    /**
     * Multiplier applied when a player has no fatigue (full strength).
     * Should always be 1.0 for no penalty.
     */
    public static readonly NO_FATIGUE_MULTIPLIER = 1.0;

    // ============================================================================
    // K-Factor (Rating Volatility)
    // ============================================================================

    /**
     * K-factor for highly rated players (above K_FACTOR_HIGH_THRESHOLD).
     * Lower value = more stable ratings, smaller ELO changes per game.
     * Prevents top players' ratings from fluctuating too wildly.
     */
    public static readonly K_FACTOR_HIGH = 32;

    /**
     * K-factor for mid-tier players (between MID and HIGH thresholds).
     * Medium volatility for players establishing their skill level.
     */
    public static readonly K_FACTOR_MID = 48;

    /**
     * K-factor for lower rated players (below K_FACTOR_MID_THRESHOLD).
     * Higher value = more volatile ratings, larger ELO changes per game.
     * Allows new/lower-rated players to reach their true rating faster.
     */
    public static readonly K_FACTOR_LOW = 64;

    /**
     * ELO threshold above which the high K-factor (16) applies.
     * Players above this rating are considered "highly rated".
     */
    public static readonly K_FACTOR_HIGH_THRESHOLD = 2000;

    /**
     * ELO threshold above which the mid K-factor (24) applies.
     * Players between MID_THRESHOLD and HIGH_THRESHOLD use K=24.
     * Players below this threshold use K=32.
     */
    public static readonly K_FACTOR_MID_THRESHOLD = 1800;

    // ============================================================================
    // ELO Expected Score Calculation
    // ============================================================================

    /**
     * Divisor used in the ELO expected score formula: 1 / (1 + 10^(diff/DIVISOR))
     * Standard chess value is 400. Controls the sensitivity of expected win probability
     * to rating differences.
     * - Smaller values: Rating differences matter more (steeper probability curve)
     * - Larger values: Rating differences matter less (flatter probability curve)
     * Example: With 400, a 200-point advantage = ~76% expected win rate.
     */
    public static readonly ELO_DIFF_DIVISOR = 400;

    // ============================================================================
    // Game Result Scores
    // ============================================================================

    /**
     * Score assigned to a draw when calculating actual vs expected results.
     * Standard value is 0.5 (halfway between a loss and a win).
     */
    public static readonly DRAW_SCORE = 0.5;

    /**
     * Score assigned to a win when calculating actual vs expected results.
     * Always 1 in standard ELO systems.
     */
    public static readonly WIN_SCORE = 1;

    /**
     * Score assigned to a loss when calculating actual vs expected results.
     * Always 0 in standard ELO systems.
     */
    public static readonly LOSS_SCORE = 0;

    /**
     * Multiplier that reduces the ELO impact of draws.
     * Draws have less ELO swing than wins/losses to prevent extreme rating changes
     * for favorites/underdogs in draw scenarios.
     * Range: 0.0 (draws have no ELO impact) to 1.0 (draws have full impact)
     * Default: 0.5 means draws cause 50% of the ELO impact of a win/loss.
     * Example: A favorite losing 15 ELO in a draw would lose 7.5 ELO instead.
     */
    public static readonly DRAW_ELO_MULTIPLIER = 0.6;

    // ============================================================================
    // Goal Differential
    // ============================================================================

    /**
     * Multiplier applied to the ELO pot for drawn games.
     * Set to 1.0 since there's no goal differential in a draw.
     * This prevents inflating/deflating ELO changes for draws.
     */
    public static readonly DRAW_GOAL_MULTIPLIER = 1.0;

    // ============================================================================
    // Decisiveness Multipliers
    // ============================================================================


    public static readonly LOSS_TO_TIE = 1.15; // saved 2 pts

    public static readonly LOSS_TO_WIN = 1.4;

    public static readonly TIE_TO_WIN = 1.25;  //saved 2 pts

    public static readonly NO_IMPACT = 0.40;

    // ============================================================================
    // Goal Scoring Bonuses
    // ============================================================================

    /**
     * Bonus multiplier for scoring a single goal.
     */
    public static readonly SINGLE_GOAL_BONUS = 0.15;

    /**
     * Bonus multiplier for scoring two goals.
     */
    public static readonly DOUBLE_GOAL_BONUS = 0.35;

    // ============================================================================
    // Goalkeeper Bonuses
    // ============================================================================

    /**
     * Coefficient applied to goal bonuses for goalkeepers (they score less often).
     */
    public static readonly GK_GOAL_COEF = 2.0;

    /**
     * Bonus for goalkeeper when no goals are allowed (clean sheet).
     */
    public static readonly CLEAN_SHEET_BONUS = 0.4;

    /**
     * Bonus for goalkeeper when only one goal is allowed.
     */
    public static readonly ONE_GOAL_ALLOWED_BONUS = 0.2;

    /**
     * Bonus for goalkeeper when only two goals are allowed.
     */
    public static readonly TWO_GOALS_ALLOWED_BONUS = 0.1;

    // ============================================================================
    // Team Configuration
    // ============================================================================

    /**
     * The number of players required per team in a game.
     * Used for validation and averaging calculations.
     * Current: 5 (standard futsal team size).
     */
    public static readonly TEAM_SIZE = 5;
}