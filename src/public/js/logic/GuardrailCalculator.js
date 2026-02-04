import { Config } from './Config.js';
import { SpendingProfile } from './SpendingProfile.js';
import { CashFlowModel } from './CashFlowModel.js';
import { MonteCarloSimulation } from './MonteCarloSimulation.js';

export class GuardrailCalculator {
    constructor(
        lowerGuardrailPos = null,
        upperGuardrailPos = null,
        targetPos = null,
        spendingAdjustmentPercentage = null
    ) {
        this.config = Config;

        // Use provided values or defaults from config
        this.lowerGuardrailPos = lowerGuardrailPos ?? this.config.guardrails.default_lower;
        this.upperGuardrailPos = upperGuardrailPos ?? this.config.guardrails.default_upper;
        this.targetPos = targetPos ?? this.config.guardrails.default_target;
        this.spendingAdjustmentPercentage = spendingAdjustmentPercentage ?? this.config.guardrails.default_adjustment;

        this.validateGuardrails();
    }

    validateGuardrails() {
        if (this.lowerGuardrailPos >= this.upperGuardrailPos) {
            console.warn("Lower guardrail must be less than upper guardrail");
        }

        if (this.targetPos < this.lowerGuardrailPos || this.targetPos > this.upperGuardrailPos) {
            console.warn("Target PoS must be between lower and upper guardrails");
        }

        const minLower = this.config.guardrails.min_lower;
        const maxUpper = this.config.guardrails.max_upper;

        if (this.lowerGuardrailPos < minLower) {
            console.warn(`Lower guardrail cannot be less than ${minLower}%`);
        }

        if (this.upperGuardrailPos > maxUpper) {
            console.warn(`Upper guardrail cannot exceed ${maxUpper}%`);
        }
    }

    calculate(params) {
        const startTime = performance.now();

        // Extract and validate parameters
        this.validateParams(params);
        this.applyGuardrailsFromParams(params);

        // Create spending profile
        const spendingProfile = this.createSpendingProfile(params);

        // Create cash flow model
        const cashFlowModel = new CashFlowModel(
            spendingProfile,
            params.inflation_rate
        );

        // Add income sources
        if (params.income_sources && Array.isArray(params.income_sources)) {
            for (const source of params.income_sources) {
                cashFlowModel.addIncomeSource(
                    source.name,
                    parseFloat(source.annual_amount),
                    parseInt(source.start_age),
                    source.end_age ? parseInt(source.end_age) : null,
                    source.inflation_adjusted ?? true
                );
            }
        }

        // Add future expense items
        if (params.future_expenses && Array.isArray(params.future_expenses)) {
            for (const item of params.future_expenses) {
                cashFlowModel.addExpenseItem(
                    item.name,
                    parseFloat(item.annual_amount),
                    parseInt(item.start_age),
                    item.end_age != null ? parseInt(item.end_age) : null,
                    item.inflation_adjusted ?? true,
                    item.one_time ?? false
                );
            }
        }

        // Create and run Monte Carlo simulation
        const currentAge = params.spouse1_age ?? params.current_age;
        const year0Income = cashFlowModel.getIncomeForYear(currentAge, 0);
        const year0Expenses = cashFlowModel.getExpensesForYear(currentAge, 0);
        const year0NetWithdrawal = params.desired_spending + year0Expenses - year0Income;

        const simulation = this.createSimulation(params, cashFlowModel, params.desired_spending, currentAge);
        const mcResults = simulation.runSimulation();

        // Determine guardrail status and recommendations
        const probabilityOfSuccess = mcResults.probability_of_success;
        const guardrailStatus = this.determineGuardrailStatus(probabilityOfSuccess);
        const spendingAdjustment = this.determineSpendingAdjustment(guardrailStatus);

        let recommendedSpending;

        // Calculate recommended spending using target-seeking approach if needed
        if (spendingAdjustment === 'maintain') {
            recommendedSpending = params.desired_spending;
        } else {
            recommendedSpending = this.findSpendingForTargetPos(
                params,
                cashFlowModel,
                spendingAdjustment,
                currentAge
            );
        }

        // Calculate current withdrawal rate
        const currentWithdrawalRate = (params.desired_spending / params.current_portfolio_value) * 100;

        const endTime = performance.now();
        const totalDurationMs = Math.round(endTime - startTime);

        return {
            probability_of_success: probabilityOfSuccess,
            guardrail_status: guardrailStatus,
            spending_adjustment_needed: spendingAdjustment,
            desired_spending: params.desired_spending,
            recommended_spending: recommendedSpending,
            spending_change_amount: recommendedSpending - params.desired_spending,
            spending_change_percentage: this.calculatePercentageChange(
                params.desired_spending,
                recommendedSpending
            ),
            current_withdrawal_rate: parseFloat(currentWithdrawalRate.toFixed(2)),
            interpretation: this.generateInterpretation({
                probability_of_success: probabilityOfSuccess,
                guardrail_status: guardrailStatus,
                desired_spending: params.desired_spending,
                recommended_spending: recommendedSpending,
                spending_change_amount: recommendedSpending - params.desired_spending,
            }),
            guardrail_thresholds: {
                lower: this.lowerGuardrailPos,
                upper: this.upperGuardrailPos,
                target: this.targetPos,
            },
            monte_carlo: mcResults,
            portfolio_metrics: {
                current_value: params.current_portfolio_value,
                expected_return: parseFloat((simulation.getExpectedReturn() * 100).toFixed(2)),
                portfolio_volatility: parseFloat((simulation.getPortfolioVolatility() * 100).toFixed(2)),
            },
            income_impact: {
                year0_income: year0Income,
                year0_expenses: year0Expenses,
                year0_net_withdrawal: year0NetWithdrawal,
            },
            cashflow_timeline: this.buildCashflowTimeline(
                cashFlowModel,
                params.desired_spending,
                currentAge,
                params.retirement_age,
                params.planning_horizon_years
            ),
            calculation_duration_ms: totalDurationMs,
        };
    }

    buildCashflowTimeline(cashFlowModel, desiredSpending, currentAge, retirementAge, planningHorizonYears) {
        const timeline = [];

        for (let year = 0; year < planningHorizonYears; year += 1) {
            const age = currentAge + year;
            const spending = cashFlowModel.getSpendingForYear(desiredSpending, currentAge, retirementAge, year);
            const income = cashFlowModel.getIncomeForYear(age, year);
            const expenses = cashFlowModel.getExpensesForYear(age, year);
            const netWithdrawal = spending + expenses - income;

            timeline.push({
                year,
                age,
                spending,
                income,
                expenses,
                net_withdrawal: netWithdrawal,
            });
        }

        return timeline;
    }

    createSimulation(params, cashFlowModel, spending, currentAge, iterations = null) {
        return new MonteCarloSimulation(
            cashFlowModel,
            params.current_portfolio_value,
            spending,
            currentAge,
            params.retirement_age,
            params.planning_horizon_years,
            params.stock_allocation,
            params.bond_allocation,
            params.cash_allocation,
            params.annual_fee_percentage,
            iterations ?? params.monte_carlo_iterations
        );
    }

    findSpendingForTargetPos(params, cashFlowModel, adjustmentDirection, currentAge) {
        const targetPos = this.targetPos;
        const tolerance = 0.5; // Accept within 0.5% of target
        const maxIterations = 12; // Binary search depth
        const searchSimIterations = 1000; // Lower precision for search

        const desiredSpending = params.desired_spending;
        let low, high;

        if (adjustmentDirection === 'decrease') {
            low = 0;
            high = desiredSpending;
        } else {
            low = desiredSpending;
            // Cap drastic increases at reasonable 20% withdrawal rate or just double spending
            high = Math.max(desiredSpending * 2, params.current_portfolio_value / 5);
        }

        let bestSpending = desiredSpending;
        let closestPosDiff = 100.0;

        for (let i = 0; i < maxIterations; i++) {
            let midSpending = (low + high) / 2;

            // Should not go below 0
            if (midSpending < 0) midSpending = 0;

            const sim = this.createSimulation(params, cashFlowModel, midSpending, currentAge, searchSimIterations);
            const results = sim.runSimulation();
            const pos = results.probability_of_success;

            const diff = Math.abs(pos - targetPos);
            if (diff < closestPosDiff) {
                closestPosDiff = diff;
                bestSpending = midSpending;
            }

            if (diff <= tolerance) {
                break;
            }

            if (pos < targetPos) {
                // Spending too high, need to decrease
                high = midSpending;
            } else {
                // Spending too low (PoS > Target), can increase
                low = midSpending;
            }
        }

        return Math.round(bestSpending / 10) * 10;
    }

    determineGuardrailStatus(probabilityOfSuccess) {
        if (probabilityOfSuccess > this.upperGuardrailPos) {
            return 'above_upper';
        } else if (probabilityOfSuccess < this.lowerGuardrailPos) {
            return 'below_lower';
        } else {
            return 'within_range';
        }
    }

    determineSpendingAdjustment(guardrailStatus) {
        switch (guardrailStatus) {
            case 'above_upper':
                return 'increase';
            case 'below_lower':
                return 'decrease';
            default:
                return 'maintain';
        }
    }

    applyGuardrailsFromParams(params) {
        const lower = params.lower_guardrail;
        const upper = params.upper_guardrail;
        const adjustment = params.spending_adjustment_percentage;

        if (typeof lower === 'number' && !Number.isNaN(lower)) {
            this.lowerGuardrailPos = lower;
        }

        if (typeof upper === 'number' && !Number.isNaN(upper)) {
            this.upperGuardrailPos = upper;
        }

        if (typeof adjustment === 'number' && !Number.isNaN(adjustment)) {
            this.spendingAdjustmentPercentage = adjustment;
        }

        this.validateGuardrails();
    }

    generateInterpretation(results) {
        const pos = results.probability_of_success;
        const status = results.guardrail_status;

        const formatCurrency = (amount) => {
            return '$' + Number(amount).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        };

        const messages = {
            above_upper: `Your probability of success (${pos}%) is above the upper guardrail (${this.upperGuardrailPos}%). ` +
                         `Your portfolio is performing significantly better than needed. ` +
                         `To return to your target confidence level of ${this.targetPos}%, you could increase your annual spending by ` +
                         `${formatCurrency(Math.abs(results.spending_change_amount))} to ${formatCurrency(results.recommended_spending)}.`,

            below_lower: `Your probability of success (${pos}%) is below the lower guardrail (${this.lowerGuardrailPos}%). ` +
                         `Your portfolio is at risk of depletion. ` +
                         `To restore your target confidence level of ${this.targetPos}%, you should decrease your annual spending by ` +
                         `${formatCurrency(Math.abs(results.spending_change_amount))} to ${formatCurrency(results.recommended_spending)}.`,

            within_range: `Your probability of success (${pos}%) is within the safe zone ` +
                          `(${this.lowerGuardrailPos}% - ${this.upperGuardrailPos}%). ` +
                          `Your desired spending of ${formatCurrency(results.desired_spending)} is sustainable. ` +
                          `No adjustment is needed at this time.`
        };

        return messages[status] || '';
    }

    calculatePercentageChange(original, isNew) {
        if (original === 0) {
            return 0;
        }
        return parseFloat((((isNew - original) / original) * 100).toFixed(2));
    }

    createSpendingProfile(params) {
        const profileType = params.spending_profile_type ?? 'smile';
        const customMultipliers = params.custom_spending_multipliers ?? {};

        return new SpendingProfile(profileType, customMultipliers);
    }

    validateParams(params) {
        const required = [
            'retirement_age',
            'planning_horizon_years',
            'current_portfolio_value',
            'desired_spending',
            'stock_allocation',
            'bond_allocation',
            'cash_allocation',
        ];

        for (const field of required) {
            if (params[field] === undefined || params[field] === null || params[field] === '') {
                throw new Error(`Missing required parameter: ${field}`);
            }
        }

        // Require either current_age OR spouse1_age
        if (params.current_age === undefined && params.spouse1_age === undefined) {
            throw new Error("Missing required parameter: current_age or spouse1_age");
        }

        // Use spouse1_age if available, fallback to current_age for backward compatibility
        const currentAge = params.spouse1_age ?? params.current_age;

        // Validate age parameters
        if (currentAge < params.retirement_age) {
            console.warn("Current age must be greater than or equal to age at retirement");
        }

        if (params.planning_horizon_years < 1 || params.planning_horizon_years > 60) {
            console.warn("Planning horizon must be between 1 and 60 years");
        }

        // Validate portfolio values
        if (params.current_portfolio_value <= 0) {
            console.warn("Current portfolio value must be positive");
        }

        if (params.desired_spending < 0) {
            console.warn("Desired spending cannot be negative");
        }

        // Validate allocations
        const totalAllocation = parseFloat(params.stock_allocation) + parseFloat(params.bond_allocation) + parseFloat(params.cash_allocation);
        if (Math.abs(totalAllocation - 100) > 0.01) {
            console.warn(`Asset allocations must sum to 100%, got ${totalAllocation}`);
        }

        // Set defaults for optional parameters
        if (params.annual_fee_percentage === undefined) params.annual_fee_percentage = this.config.defaults.annual_fee;
        if (params.inflation_rate === undefined) params.inflation_rate = this.config.defaults.inflation_rate;
        if (params.monte_carlo_iterations === undefined) params.monte_carlo_iterations = this.config.monte_carlo.default_iterations;
    }
}
