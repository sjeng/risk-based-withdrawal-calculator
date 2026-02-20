import { BaseReturnGenerator } from './BaseReturnGenerator.js';

export class ReturnGenerator extends BaseReturnGenerator {

    /**
     * Generate portfolio return for one year based on asset allocation
     * @param {number} stockAllocation Stock allocation (0-100)
     * @param {number} bondAllocation Bond allocation (0-100)
     * @param {number} cashAllocation Cash allocation (0-100)
     * @returns {number} Annual portfolio return (as decimal)
     */
    generateReturn(stockAllocation, bondAllocation, cashAllocation) {
        this.validateAllocations(stockAllocation, bondAllocation, cashAllocation);

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
        const z = this.standardNormal();
        return mean + (stdDev * z);
    }
}
