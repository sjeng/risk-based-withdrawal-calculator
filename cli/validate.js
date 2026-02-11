/**
 * Thin pre-validation for CLI input.
 *
 * GuardrailCalculator.validateParams() handles required-field checks,
 * defaults, and soft warnings.  This module adds the few strict checks
 * that the web form enforces but the calculator does not.
 */

/**
 * @param {object} data  Parsed JSON input
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validate(data) {
    if (data === null || typeof data !== 'object') {
        return { valid: false, message: 'Input must be a JSON object' };
    }

    // ── Required fields (mirrors calculator's validateParams, but fail early) ──
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
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }

    if (data.current_age === undefined && data.spouse1_age === undefined) {
        return { valid: false, message: 'Missing required field: current_age or spouse1_age' };
    }

    // ── Allocation sum ──
    const total = Number(data.stock_allocation) + Number(data.bond_allocation) + Number(data.cash_allocation);
    if (Math.abs(total - 100) > 0.01) {
        return {
            valid: false,
            message: `Asset allocations must sum to 100%, got ${total.toFixed(1)}%`,
        };
    }

    // ── Portfolio value must be positive ──
    if (Number(data.current_portfolio_value) <= 0) {
        return { valid: false, message: 'current_portfolio_value must be positive' };
    }

    // ── Spending non-negative ──
    if (Number(data.desired_spending) < 0) {
        return { valid: false, message: 'desired_spending cannot be negative' };
    }

    // ── Guardrail ordering (strict) ──
    const lower = data.lower_guardrail ?? 80;
    const upper = data.upper_guardrail ?? 95;
    const target = data.target_guardrail ?? 90;

    if (lower >= upper) {
        return { valid: false, message: 'lower_guardrail must be less than upper_guardrail' };
    }
    if (target <= lower || target >= upper) {
        return {
            valid: false,
            message: 'target_guardrail must be strictly between lower_guardrail and upper_guardrail',
        };
    }

    // ── Current age >= retirement age ──
    const currentAge = data.spouse1_age ?? data.current_age;
    if (currentAge < data.retirement_age) {
        return {
            valid: false,
            message: 'Current age (spouse1_age or current_age) must be >= retirement_age',
        };
    }

    // ── Expense duration-years check ──
    if (Array.isArray(data.future_expenses)) {
        for (const item of data.future_expenses) {
            if (item.type === 'duration') {
                if (!item.duration_years || Number.isNaN(Number(item.duration_years)) || item.duration_years <= 0) {
                    return {
                        valid: false,
                        message: `Duration-based expense "${item.name || '(unnamed)'}" must have a positive duration_years`,
                    };
                }
            }
        }
    }

    return { valid: true };
}
