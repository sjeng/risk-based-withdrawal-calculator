import { Config } from './Config.js';
import { SpendingProfile } from './SpendingProfile.js';
import { CashFlowModel } from './CashFlowModel.js';
import { MonteCarloSimulation } from './MonteCarloSimulation.js';
import { EnhancedReturnGenerator } from './EnhancedReturnGenerator.js';
import { formatCurrency } from './formatters.js';
import { validateInput } from './validateInput.js';

export class GuardrailCalculator {
    static SEARCH_ITERATIONS = 1000;

    constructor() {
        this.config = Config;
        this.lowerGuardrailPos = this.config.guardrails.default_lower;
        this.upperGuardrailPos = this.config.guardrails.default_upper;
        this.targetPos = this.config.guardrails.default_target;
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
        return this._calculate(params, {
            returnGenerator: null,
            includeTimeline: true,
        });
    }

    calculateEnhanced(params) {
        const autocorrelation = params.enhanced_mc_autocorrelation ??
            this.config.enhanced_mc?.default_autocorrelation ?? -0.10;
        const enhancedGen = new EnhancedReturnGenerator(autocorrelation);

        const result = this._calculate(params, {
            returnGenerator: enhancedGen,
            includeTimeline: false,
        });

        result.enhanced_mc_autocorrelation = autocorrelation;
        return result;
    }

    _calculate(params, { returnGenerator = null, includeTimeline = true } = {}) {
        const startTime = performance.now();

        this.validateParams(params);
        this.applyGuardrailsFromParams(params);

        const spendingProfile = this.createSpendingProfile(params);
        const cashFlowModel = new CashFlowModel(
            spendingProfile,
            params.inflation_rate
        );

        if (params.income_sources && Array.isArray(params.income_sources)) {
            for (const source of params.income_sources) {
                const adjustedAges = this.getAdjustedIncomeAges(source, params);
                cashFlowModel.addIncomeSource(
                    source.name,
                    parseFloat(source.annual_amount),
                    adjustedAges.start_age,
                    adjustedAges.end_age,
                    source.inflation_adjusted ?? true
                );
            }
        }

        if (params.future_expenses && Array.isArray(params.future_expenses)) {
            for (const item of params.future_expenses) {
                const normalized = this.normalizeExpense(item);
                cashFlowModel.addExpenseItem(
                    normalized.name,
                    normalized.annual_amount,
                    normalized.start_age,
                    normalized.end_age,
                    normalized.inflation_adjusted,
                    normalized.one_time
                );
            }
        }

        const currentAge = params.spouse1_age ?? params.current_age;
        const simulation = this.createSimulation(
            params,
            cashFlowModel,
            params.desired_spending,
            currentAge,
            null,
            returnGenerator
        );
        const mcResults = simulation.runSimulation();

        const probabilityOfSuccess = mcResults.probability_of_success;
        const guardrailStatus = this.determineGuardrailStatus(probabilityOfSuccess);
        const spendingAdjustment = this.determineSpendingAdjustment(guardrailStatus);

        const generatorFactory = returnGenerator
            ? () => new EnhancedReturnGenerator(returnGenerator.autocorrelation)
            : () => null;

        let recommendedSpending;
        if (spendingAdjustment === 'maintain') {
            recommendedSpending = params.desired_spending;
        } else {
            recommendedSpending = this._findSpendingForTargetPos(
                params,
                cashFlowModel,
                spendingAdjustment,
                currentAge,
                generatorFactory
            );
        }

        const currentWithdrawalRate = (params.desired_spending / params.current_portfolio_value) * 100;
        const endTime = performance.now();

        const result = {
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
            calculation_duration_ms: Math.round(endTime - startTime),
        };

        if (includeTimeline) {
            const year0Income = cashFlowModel.getIncomeForYear(currentAge, 0);
            const year0Expenses = cashFlowModel.getExpensesForYear(currentAge, 0);
            result.income_impact = {
                year0_income: year0Income,
                year0_expenses: year0Expenses,
                year0_net_withdrawal: params.desired_spending + year0Expenses - year0Income,
            };
            result.cashflow_timeline = this.buildCashflowTimeline(
                cashFlowModel,
                params.desired_spending,
                currentAge,
                params.retirement_age,
                params.planning_horizon_years
            );
        }

        return result;
    }

    buildCashflowTimeline(cashFlowModel, desiredSpending, currentAge, retirementAge, planningHorizonYears) {
        const timeline = [];

        for (let year = 0; year < planningHorizonYears; year += 1) {
            const age = currentAge + year;
            const spending = cashFlowModel.getSpendingForYear(desiredSpending, age, retirementAge, year);
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

    createSimulation(params, cashFlowModel, spending, currentAge, iterations = null, returnGenerator = null) {
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
            iterations ?? params.monte_carlo_iterations,
            returnGenerator
        );
    }

    _findSpendingForTargetPos(params, cashFlowModel, adjustmentDirection, currentAge, generatorFactory) {
        const targetPos = this.targetPos;
        const tolerance = 0.5;
        const maxIterations = 12;

        const desiredSpending = params.desired_spending;
        let low;
        let high;

        if (adjustmentDirection === 'decrease') {
            low = 0;
            high = desiredSpending;
        } else {
            low = desiredSpending;
            high = Math.max(desiredSpending * 2, params.current_portfolio_value / 5);
        }

        let bestSpending = desiredSpending;
        let closestPosDiff = 100.0;

        for (let i = 0; i < maxIterations; i++) {
            let midSpending = (low + high) / 2;
            if (midSpending < 0) midSpending = 0;

            const sim = this.createSimulation(
                params,
                cashFlowModel,
                midSpending,
                currentAge,
                GuardrailCalculator.SEARCH_ITERATIONS,
                generatorFactory()
            );
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
                high = midSpending;
            } else {
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
        const target = params.target_guardrail;

        if (typeof lower === 'number' && !Number.isNaN(lower)) {
            this.lowerGuardrailPos = lower;
        }

        if (typeof upper === 'number' && !Number.isNaN(upper)) {
            this.upperGuardrailPos = upper;
        }

        if (typeof target === 'number' && !Number.isNaN(target)) {
            this.targetPos = target;
        }

        this.validateGuardrails();
    }

    generateInterpretation(results) {
        const pos = results.probability_of_success;
        const status = results.guardrail_status;

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
        return new SpendingProfile(profileType);
    }

    /**
     * Normalize a raw future-expense object into the fields the CashFlowModel
     * consumes (end_age, one_time, inflation_adjusted).
     *
     * The web form pre-computes `end_age` and `one_time` before calling the
     * engine, but the CLI / programmatic callers pass raw input following the
     * documented schema (`type`, `duration_years`). This derives the consumed
     * fields so both paths behave identically:
     *
     *   - end_age: explicit `end_age` wins; otherwise derived from
     *     start_age + duration_years - 1 when duration_years > 0; else null.
     *   - one_time: explicit boolean wins; otherwise derived from `type`
     *     ("one_time" -> true, "duration" -> false). With no type, an expense
     *     bounded by end_age/duration is recurring; an unbounded one defaults
     *     to a single charge (schema default type = "one_time").
     *   - inflation_adjusted: defaults to false (matches the schema and web
     *     form). Previously defaulted to true, silently inflating expenses.
     *
     * @param {object} item Raw expense input
     * @returns {{name:string, annual_amount:number, start_age:number, end_age:(number|null), inflation_adjusted:boolean, one_time:boolean}}
     */
    normalizeExpense(item) {
        const startAge = parseInt(item.start_age);
        const durationYears = item.duration_years != null ? parseInt(item.duration_years) : null;

        let endAge;
        if (item.end_age != null && item.end_age !== '') {
            endAge = parseInt(item.end_age);
        } else if (durationYears != null && durationYears > 0) {
            endAge = startAge + durationYears - 1;
        } else {
            endAge = null;
        }

        let oneTime;
        if (typeof item.one_time === 'boolean') {
            oneTime = item.one_time;
        } else if (item.type === 'one_time') {
            oneTime = true;
        } else if (item.type === 'duration') {
            oneTime = false;
        } else if (endAge != null) {
            // No type, but bounded by an end age (or derived duration): recurring.
            oneTime = false;
        } else {
            // No type and unbounded: schema default type is "one_time".
            oneTime = true;
        }

        return {
            name: item.name,
            annual_amount: parseFloat(item.annual_amount),
            start_age: startAge,
            end_age: endAge,
            inflation_adjusted: item.inflation_adjusted ?? false,
            one_time: oneTime,
        };
    }

    getAdjustedIncomeAges(source, params) {
        const startAge = parseInt(source.start_age);
        const endAge = source.end_age != null && source.end_age !== ''
            ? parseInt(source.end_age)
            : null;
        const recipient = source.recipient ?? 'household';

        if (recipient === 'spouse2') {
            const primaryAge = params.spouse1_age ?? params.current_age;
            const spouse2Age = params.spouse2_age;

            if (Number.isFinite(primaryAge) && Number.isFinite(spouse2Age)) {
                const offset = primaryAge - spouse2Age;
                return {
                    start_age: startAge + offset,
                    end_age: endAge != null ? endAge + offset : null,
                };
            }
        }

        return {
            start_age: startAge,
            end_age: endAge,
        };
    }

    validateParams(params) {
        const errors = validateInput(params);
        const criticalErrors = errors.filter(error => error.message.startsWith('Missing required field'));

        if (criticalErrors.length > 0) {
            throw new Error(criticalErrors[0].message);
        }

        for (const error of errors) {
            if (!error.message.startsWith('Missing required field')) {
                console.warn(error.message);
            }
        }

        if (params.annual_fee_percentage === undefined) params.annual_fee_percentage = this.config.defaults.annual_fee;
        if (params.inflation_rate === undefined) params.inflation_rate = this.config.defaults.inflation_rate;
        if (params.monte_carlo_iterations === undefined) params.monte_carlo_iterations = this.config.monte_carlo.default_iterations;
    }
}
