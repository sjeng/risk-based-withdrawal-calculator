import { Config } from './Config.js';
import { ReturnGenerator } from './ReturnGenerator.js';

export class MonteCarloSimulation {
    /**
     * @param {import('./CashFlowModel.js').CashFlowModel} cashFlowModel 
     * @param {number} currentPortfolioValue 
     * @param {number} desiredSpending 
     * @param {number} currentAge 
     * @param {number} retirementAge 
     * @param {number} planningHorizonYears 
     * @param {number} stockAllocation 
     * @param {number} bondAllocation 
     * @param {number} cashAllocation 
     * @param {number} annualFeePercentage 
     * @param {number} iterations 
     */
    constructor(
        cashFlowModel,
        currentPortfolioValue,
        desiredSpending,
        currentAge,
        retirementAge,
        planningHorizonYears,
        stockAllocation,
        bondAllocation,
        cashAllocation,
        annualFeePercentage = 0.0075,
        iterations = 10000,
        returnGenerator = null
    ) {
        this.config = Config;
        this.returnGenerator = returnGenerator || new ReturnGenerator();
        this.cashFlowModel = cashFlowModel;

        this.currentPortfolioValue = currentPortfolioValue;
        this.desiredSpending = desiredSpending;
        this.currentAge = currentAge;
        this.retirementAge = retirementAge;
        this.planningHorizonYears = planningHorizonYears;

        this.stockAllocation = stockAllocation;
        this.bondAllocation = bondAllocation;
        this.cashAllocation = cashAllocation;
        this.annualFeePercentage = annualFeePercentage;

        this.validateIterations(iterations);
        this.iterations = iterations;

        this.validateAllocations();
    }

    validateIterations(iterations) {
        const min = this.config.monte_carlo.min_iterations;
        const max = this.config.monte_carlo.max_iterations;

        if (iterations < min || iterations > max) {
            console.warn(`Iterations must be between ${min} and ${max}, got ${iterations}`);
        }
    }

    validateAllocations() {
        const total = this.stockAllocation + this.bondAllocation + this.cashAllocation;
        if (Math.abs(total - 100.0) > 0.01) {
            console.warn(`Asset allocations must sum to 100%. Current total: ${total}%`);
        }
    }

    runSimulation() {
        const startTime = performance.now();

        this.simulationResults = [];
        this.successfulIterations = 0;
        this.failedIterations = 0;

        // Run all iterations
        for (let i = 0; i < this.iterations; i++) {
            const iterationResult = this.runSingleIteration();
            this.simulationResults.push(iterationResult);

            if (iterationResult.success) {
                this.successfulIterations++;
            } else {
                this.failedIterations++;
            }
        }

        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        // Calculate results
        const probabilityOfSuccess = (this.successfulIterations / this.iterations) * 100;

        return {
            probability_of_success: Number(probabilityOfSuccess.toFixed(2)),
            iterations: this.iterations,
            successful: this.successfulIterations,
            failed: this.failedIterations,
            duration_ms: durationMs,
            percentiles: this.calculatePercentiles(),
            yearly_percentiles: this.calculateYearlyPercentiles(),
        };
    }

    runSingleIteration() {
        // Reset return generator state (clears AR(1) memory for enhanced mode)
        if (typeof this.returnGenerator.reset === 'function') {
            this.returnGenerator.reset();
        }

        let portfolioValue = this.currentPortfolioValue;
        const yearlyValues = [];
        let success = true;
        let depletionYear = null;

        for (let year = 0; year < this.planningHorizonYears; year++) {
            const age = this.currentAge + year;

            // Generate random return for this year
            const annualReturn = this.returnGenerator.generateReturn(
                this.stockAllocation,
                this.bondAllocation,
                this.cashAllocation
            );

            // Apply investment return to beginning portfolio value
            portfolioValue *= (1 + annualReturn);

            // Subtract fees
            portfolioValue *= (1 - this.annualFeePercentage);

            // Get spending for this year
            const spending = this.cashFlowModel.getSpendingForYear(
                this.desiredSpending,
                age,
                this.retirementAge,
                year
            );

            // Get income for this year
            const income = this.cashFlowModel.getIncomeForYear(age, year);

            // Get additional expenses for this year
            const extraExpenses = this.cashFlowModel.getExpensesForYear(age, year);

            // Calculate net withdrawal
            const netWithdrawal = spending + extraExpenses - income;

            // Apply withdrawal (or contribution if negative)
            portfolioValue -= netWithdrawal;

            // Check for depletion
            if (portfolioValue <= 0) {
                success = false;
                depletionYear = year;
                portfolioValue = 0;
            }

            yearlyValues.push({
                year: year,
                age: age,
                portfolio_value: portfolioValue,
                annual_return: annualReturn,
                spending: spending,
                extra_expenses: extraExpenses,
                income: income,
                net_withdrawal: netWithdrawal,
            });

            // If portfolio depleted, stop projecting
            if (!success) {
                break;
            }
        }

        return {
            success: success,
            final_portfolio_value: portfolioValue,
            depletion_year: depletionYear,
            yearly_values: yearlyValues,
        };
    }

    calculatePercentiles() {
        const finalValues = this.simulationResults.map(result => result.final_portfolio_value);
        finalValues.sort((a, b) => a - b);

        return {
            p10: this.getPercentile(finalValues, 10),
            p25: this.getPercentile(finalValues, 25),
            p50: this.getPercentile(finalValues, 50), // Median
            p75: this.getPercentile(finalValues, 75),
            p90: this.getPercentile(finalValues, 90),
            min: Math.min(...finalValues),
            max: Math.max(...finalValues),
        };
    }

    calculateYearlyPercentiles() {
        const yearlyPercentiles = [];

        for (let year = 0; year < this.planningHorizonYears; year++) {
            const yearValues = [];

            for (const result of this.simulationResults) {
                // Get portfolio value for this year if it exists
                if (result.yearly_values[year]) {
                    yearValues.push(result.yearly_values[year].portfolio_value);
                } else {
                    // Portfolio was depleted before this year
                    yearValues.push(0);
                }
            }

            yearValues.sort((a, b) => a - b);
            
            yearlyPercentiles.push({
                year: year,
                age: this.currentAge + year,
                p10: this.getPercentile(yearValues, 10),
                p25: this.getPercentile(yearValues, 25),
                p50: this.getPercentile(yearValues, 50),
                p75: this.getPercentile(yearValues, 75),
                p90: this.getPercentile(yearValues, 90),
            });
        }

        return yearlyPercentiles;
    }

    getPercentile(sortedValues, percentile) {
        const count = sortedValues.length;
        if (count === 0) {
            return 0;
        }

        const index = (percentile / 100) * (count - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);

        if (lower === upper) {
            return sortedValues[lower];
        }

        // Linear interpolation
        const weight = index - lower;
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    getExpectedReturn() {
        return this.returnGenerator.getExpectedReturn(
            this.stockAllocation,
            this.bondAllocation,
            this.cashAllocation
        );
    }

    getPortfolioVolatility() {
        return this.returnGenerator.getPortfolioVolatility(
            this.stockAllocation,
            this.bondAllocation,
            this.cashAllocation
        );
    }
}
