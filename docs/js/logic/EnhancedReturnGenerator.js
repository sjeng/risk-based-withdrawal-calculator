import { Config } from './Config.js';

/**
 * EnhancedReturnGenerator uses log-normal returns with geometric-mean centering
 * and AR(1) autocorrelation to address the over-optimism of standard i.i.d.
 * normal Monte Carlo simulation.
 *
 * Key improvements over the standard ReturnGenerator:
 *
 * 1. Log-normal returns centered on the geometric mean: Standard MC draws from
 *    N(μ, σ) where μ is the arithmetic mean, causing expected per-period returns
 *    to equal the arithmetic mean. But actual compound growth tracks the geometric
 *    mean, which is lower by approximately σ²/2. The enhanced model uses log-normal
 *    returns parameterized so the expected per-period return equals the geometric
 *    mean — (1+μ)/exp(σ_log²/2) − 1 — naturally penalizing higher-volatility
 *    portfolios more. This directly addresses the Kitces/Fitzpatrick/Tharp (2022)
 *    finding that standard MC overstates sustainable spending by 5–10% at typical
 *    confidence levels (70–90% PoS).
 *
 * 2. AR(1) autocorrelation: Models serial dependence in returns at the annual
 *    horizon. With negative φ (mean reversion), after extreme years the expected
 *    return tilts back toward the long-run mean. This subtly reshapes the
 *    distribution of multi-year sequences without changing unconditional variance.
 *
 * The combined effect produces meaningfully lower PoS than standard MC for
 * equity-heavy portfolios, consistent with historical backtesting results.
 *
 * Reference: Kitces.com — "Evaluating Retirement Spending Risk: Monte Carlo Vs Historical Simulations"
 * Calibration: Poterba & Summers (1988), Fama & French (1988) — annual equity autocorrelation
 *              estimates range from -0.05 to -0.20. Default φ = -0.10 is conservative.
 */
export class EnhancedReturnGenerator {
    constructor(autocorrelation = null) {
        this.config = Config;
        this.returnAssumptions = this.config.return_assumptions;
        this.correlations = this.config.correlations;

        this.autocorrelation = autocorrelation ??
            this.config.enhanced_mc?.default_autocorrelation ?? -0.10;

        // State for AR(1) process — stores previous log return
        this.previousLogReturn = null;
    }

    /**
     * Reset AR(1) state at the start of each Monte Carlo iteration.
     * Each simulated retirement sequence should begin independently.
     */
    reset() {
        this.previousLogReturn = null;
    }

    /**
     * Generate a single year's portfolio return using log-normal distribution
     * with AR(1) autocorrelation (mean reversion).
     */
    generateReturn(stockAllocation, bondAllocation, cashAllocation) {
        const total = stockAllocation + bondAllocation + cashAllocation;
        if (Math.abs(total - 100.0) > 0.01) {
            console.warn("Asset allocations should sum to 100%, got: " + total);
        }

        const portfolioMean = this.getExpectedReturn(stockAllocation, bondAllocation, cashAllocation);
        const portfolioVol = this.getPortfolioVolatility(stockAllocation, bondAllocation, cashAllocation);

        return this.generateLogNormalReturnWithAR1(portfolioMean, portfolioVol);
    }

    /**
     * Generate a log-normal return with AR(1) autocorrelation.
     *
     * The arithmetic mean (portfolioMean) is the expected return in simple terms (e.g., 0.08).
     * We convert to log-space parameters, apply the AR(1) process there, then convert back.
     *
     * Log-space parameters (geometric-mean centering):
     *   σ_log = sqrt(ln(1 + σ² / (1+μ)²))
     *   μ_log = ln(1+μ) - σ_log²
     *
     * The standard parameterization uses μ_log = ln(1+μ) - σ_log²/2, which preserves
     * the arithmetic mean E[r] = μ and makes log-normal nearly equivalent to normal
     * MC. By using σ_log² (full volatility drag) instead, the expected per-period
     * return drops to the geometric mean: E[r] = (1+μ)/exp(σ_log²/2) - 1, which is
     * approximately μ - σ²/(2(1+μ)²). This penalizes higher-volatility portfolios
     * more and produces PoS results more consistent with historical backtesting.
     *
     * AR(1) process in log space:
     *   ln(1+r_t) = μ_log + φ * (ln(1+r_{t-1}) - μ_log) + σ_ε * z_t
     *   where σ_ε = σ_log * sqrt(1 - φ²) to preserve unconditional variance
     *
     * @param {number} arithmeticMean - Expected portfolio return (e.g., 0.08 for 8%)
     * @param {number} arithmeticVol - Portfolio standard deviation (e.g., 0.12 for 12%)
     * @returns {number} A single year's return (e.g., 0.05 for +5%)
     */
    generateLogNormalReturnWithAR1(arithmeticMean, arithmeticVol) {
        // Convert arithmetic parameters to log-space
        const mu = arithmeticMean;
        const sigma = arithmeticVol;

        // Guard against edge case of zero volatility
        if (sigma < 1e-10) {
            return mu;
        }

        const sigmaLog = Math.sqrt(Math.log(1 + (sigma * sigma) / ((1 + mu) * (1 + mu))));
        // Full volatility drag: geometric-mean centering (σ_log² instead of σ_log²/2)
        const muLog = Math.log(1 + mu) - sigmaLog * sigmaLog;

        const phi = this.autocorrelation;

        // Innovation standard deviation, scaled to preserve unconditional variance
        const sigmaEpsilon = sigmaLog * Math.sqrt(1 - phi * phi);

        // Generate standard normal variate via Box-Muller
        const z = this.standardNormal();

        let logReturn;

        if (this.previousLogReturn === null) {
            // First year: draw from the unconditional distribution
            logReturn = muLog + sigmaLog * z;
        } else {
            // Subsequent years: AR(1) process
            logReturn = muLog + phi * (this.previousLogReturn - muLog) + sigmaEpsilon * z;
        }

        // Store for next year's AR(1) process
        this.previousLogReturn = logReturn;

        // Convert back from log return to simple return
        // exp(logReturn) = 1 + r, so r = exp(logReturn) - 1
        const simpleReturn = Math.exp(logReturn) - 1;

        return simpleReturn;
    }

    /**
     * Generate a standard normal random variate using the Box-Muller transform.
     */
    standardNormal() {
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    /**
     * Portfolio expected return — same formula as ReturnGenerator.
     */
    getExpectedReturn(stockAllocation, bondAllocation, cashAllocation) {
        const stockWeight = stockAllocation / 100.0;
        const bondWeight = bondAllocation / 100.0;
        const cashWeight = cashAllocation / 100.0;

        return (
            stockWeight * this.returnAssumptions.stocks.mean +
            bondWeight * this.returnAssumptions.bonds.mean +
            cashWeight * this.returnAssumptions.cash.mean
        );
    }

    /**
     * Portfolio volatility — same formula as ReturnGenerator.
     */
    getPortfolioVolatility(stockAllocation, bondAllocation, cashAllocation) {
        const wS = stockAllocation / 100.0;
        const wB = bondAllocation / 100.0;
        const wC = cashAllocation / 100.0;

        const sdS = this.returnAssumptions.stocks.std_dev;
        const sdB = this.returnAssumptions.bonds.std_dev;
        const sdC = this.returnAssumptions.cash.std_dev;

        const corrSB = this.correlations.stocks_bonds ?? 0.0;
        const corrSC = this.correlations.stocks_cash ?? 0.0;
        const corrBC = this.correlations.bonds_cash ?? 0.0;

        const variance =
            (Math.pow(wS * sdS, 2)) +
            (Math.pow(wB * sdB, 2)) +
            (Math.pow(wC * sdC, 2)) +
            (2 * wS * wB * sdS * sdB * corrSB) +
            (2 * wS * wC * sdS * sdC * corrSC) +
            (2 * wB * wC * sdB * sdC * corrBC);

        return Math.sqrt(variance);
    }
}
