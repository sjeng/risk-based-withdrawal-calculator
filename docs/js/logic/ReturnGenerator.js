import { Config } from './Config.js';

export class ReturnGenerator {
    constructor() {
        this.config = Config;
        this.returnAssumptions = this.config.return_assumptions;
        this.correlations = this.config.correlations;
    }

    /**
     * Generate portfolio return for one year based on asset allocation
     * @param {number} stockAllocation Stock allocation (0-100)
     * @param {number} bondAllocation Bond allocation (0-100)
     * @param {number} cashAllocation Cash allocation (0-100)
     * @returns {number} Annual portfolio return (as decimal)
     */
    generateReturn(stockAllocation, bondAllocation, cashAllocation) {
        // Validate allocations sum to 100
        const total = stockAllocation + bondAllocation + cashAllocation;
        // Using slight epsilon for float comparison safety
        if (Math.abs(total - 100.0) > 0.01) {
            console.warn("Asset allocations should sum to 100%, got: " + total);
        }

        const portfolioExpectedReturn = this.getExpectedReturn(stockAllocation, bondAllocation, cashAllocation);
        const portfolioVolatility = this.getPortfolioVolatility(stockAllocation, bondAllocation, cashAllocation);

        return this.generateNormalReturn(portfolioExpectedReturn, portfolioVolatility);
    }

    /**
     * Generate random return from normal distribution using Box-Muller transform
     * @param {number} mean 
     * @param {number} stdDev 
     * @returns {number}
     */
    generateNormalReturn(mean, stdDev) {
        let u1 = 0, u2 = 0;
        // Math.random() returns [0, 1), but we need (0, 1) to avoid log(0)
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();

        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return mean + (stdDev * z);
    }

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
