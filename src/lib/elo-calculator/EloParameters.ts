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
     * Controls how severely accumulated fatigue reduces a player's effective ELO.
     * Formula: coefficient = max(FATIGUE_MIN_COEFFICIENT, 1.0 - fatigueX * FATIGUE_COEFFICIENT)
     * Example: With 0.003, 20 minutes of fatigue = 6% penalty (1.0 - 20 * 0.003 = 0.94)
     */
    public static readonly FATIGUE_COEFFICIENT = 0.003;

    /**
     * Minimum fatigue coefficient (maximum penalty for extreme fatigue).
     * Prevents fatigue from reducing ELO by more than 15%.
     */
    public static readonly FATIGUE_MIN_COEFFICIENT = 0.85;

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
     * OPTIMIZED: Increased from 48 to 56 for faster convergence to true skill.
     */
    public static readonly K_FACTOR_HIGH = 56;

    /**
     * K-factor for mid-tier players (between MID and HIGH thresholds).
     * Medium volatility for players establishing their skill level.
     * OPTIMIZED: Decreased from 64 to 60 for more consistent ratings.
     */
    public static readonly K_FACTOR_MID = 60;

    /**
     * K-factor for lower rated players (below K_FACTOR_MID_THRESHOLD).
     * Higher value = more volatile ratings, larger ELO changes per game.
     * Allows new/lower-rated players to reach their true rating faster.
     * OPTIMIZED: Decreased from 80 to 64 to reduce over-correction.
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
     * OPTIMIZED: Increased from 400 to 450 for better calibration with team-based games.
     * This accounts for the higher variance in team sports vs 1v1 games.
     */
    public static readonly ELO_DIFF_DIVISOR = 450;

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
    // Margin of Victory
    // ============================================================================

    /**
     * Base multiplier applied to all games (1.0 = no bonus for 1-goal margin).
     */
    public static readonly MOV_BASE = 1.0;

    /**
     * Bonus multiplier per goal difference.
     * Formula: movMultiplier = MOV_BASE + ln(1 + goalDiff) * MOV_SCALING
     * OPTIMIZED: Reduced from 0.25 to 0.15 for better prediction accuracy.
     * With MOV_SCALING = 0.15:
     * - 1 goal diff: 1.0 + ln(2) * 0.15 = 1.10 (10% bonus)
     * - 2 goal diff: 1.0 + ln(3) * 0.15 = 1.16 (16% bonus)
     * - 3 goal diff: 1.0 + ln(4) * 0.15 = 1.21 (21% bonus)
     * Uses logarithm to prevent blowout games from giving excessive ELO.
     */
    public static readonly MOV_SCALING = 0.15;

    // ============================================================================
    // Rating Confidence
    // ============================================================================

    /**
     * Multiplier applied to K-factor for new players (few games played).
     * Higher value = faster rating changes for newcomers.
     */
    public static readonly CONFIDENCE_NEWCOMER_MULTIPLIER = 1.5;

    /**
     * Number of games after which a player is considered "established".
     * Players with fewer games get a boosted K-factor.
     */
    public static readonly CONFIDENCE_GAMES_THRESHOLD = 20;

    // ============================================================================
    // Goal Differential (Legacy)
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

    /**
     * OPTIMIZED: Reduced decisiveness bonuses to prioritize team wins over individual clutch plays.
     * Original values over-rewarded players who scored "important" goals.
     */
    public static readonly LOSS_TO_TIE = 1.08; // Reduced from 1.15

    public static readonly LOSS_TO_WIN = 1.20; // Reduced from 1.4

    public static readonly TIE_TO_WIN = 1.12; // Reduced from 1.25

    public static readonly NO_IMPACT = 0.50; // Increased from 0.40 - less penalty for non-scorers

    // ============================================================================
    // Goal Scoring Bonuses
    // ============================================================================

    /**
     * Bonus multiplier for scoring a single goal.
     * OPTIMIZED: Reduced from 0.15 to 0.10 to prioritize team wins over individual goals.
     */
    public static readonly SINGLE_GOAL_BONUS = 0.10;

    /**
     * Bonus multiplier for scoring two goals.
     * OPTIMIZED: Reduced from 0.35 to 0.20 to prioritize team wins over individual goals.
     */
    public static readonly DOUBLE_GOAL_BONUS = 0.20;

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

    // ============================================================================
    // Chemistry System
    // ============================================================================

    /**
     * Minimum chemistry coefficient (maximum penalty for poor chemistry).
     * Applied when a player consistently loses with their teammates.
     * OPTIMIZED: Reduced impact from 0.80 to 0.90 (max 10% penalty instead of 20%).
     * Chemistry adds noise to predictions; smaller impact improves accuracy.
     */
    public static readonly CHEMISTRY_MIN_COEFFICIENT = 0.90;

    /**
     * Maximum chemistry coefficient (maximum bonus for excellent chemistry).
     * Applied when a player consistently wins with their teammates.
     * OPTIMIZED: Reduced impact from 1.20 to 1.10 (max 10% bonus instead of 20%).
     * Chemistry adds noise to predictions; smaller impact improves accuracy.
     */
    public static readonly CHEMISTRY_MAX_COEFFICIENT = 1.10;

    /**
     * Default chemistry value for unknown pairings (never played together).
     * Set slightly below neutral (0.5) to create a small penalty for unfamiliar teammates.
     * This encourages team stability and rewards players who develop chemistry.
     */
    public static readonly CHEMISTRY_NEUTRAL = 0.45;

    /**
     * Number of games played together required for full chemistry confidence.
     * Chemistry weight increases linearly from 0 to 1 as games approach this threshold.
     * Formula: confidence = min(1, totalGames / GAMES_FOR_FULL_CONFIDENCE)
     * Current: 10 games means chemistry data is fully trusted after 10 games together.
     */
    public static readonly GAMES_FOR_FULL_CONFIDENCE = 10;
}