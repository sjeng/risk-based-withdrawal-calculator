/**
 * Shared input validation for CLI and calculator engine.
 * Returns an array of { field, message } error objects.
 */
export function validateInput(data) {
    const errors = [];

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
            errors.push({ field, message: `Missing required field: ${field}` });
        }
    }

    if (data.current_age === undefined && data.spouse1_age === undefined) {
        errors.push({ field: 'current_age', message: 'Missing required field: current_age or spouse1_age' });
    }

    if (errors.length > 0) return errors;

    const totalAllocation = Number(data.stock_allocation) + Number(data.bond_allocation) + Number(data.cash_allocation);
    if (Math.abs(totalAllocation - 100) > 0.01) {
        errors.push({
            field: 'stock_allocation',
            message: `Asset allocations must sum to 100%, got ${totalAllocation.toFixed(1)}%`,
        });
    }

    if (Number(data.current_portfolio_value) <= 0) {
        errors.push({ field: 'current_portfolio_value', message: 'current_portfolio_value must be positive' });
    }

    if (Number(data.desired_spending) < 0) {
        errors.push({ field: 'desired_spending', message: 'desired_spending cannot be negative' });
    }

    const lower = data.lower_guardrail ?? 80;
    const upper = data.upper_guardrail ?? 95;
    const target = data.target_guardrail ?? 90;

    if (lower >= upper) {
        errors.push({ field: 'lower_guardrail', message: 'lower_guardrail must be less than upper_guardrail' });
    }
    if (target <= lower || target >= upper) {
        errors.push({
            field: 'target_guardrail',
            message: 'target_guardrail must be strictly between lower_guardrail and upper_guardrail',
        });
    }

    const currentAge = data.spouse1_age ?? data.current_age;
    if (currentAge < data.retirement_age) {
        errors.push({
            field: 'current_age',
            message: 'Current age (spouse1_age or current_age) must be >= retirement_age',
        });
    }

    if (data.planning_horizon_years < 1 || data.planning_horizon_years > 60) {
        errors.push({ field: 'planning_horizon_years', message: 'Planning horizon must be between 1 and 60 years' });
    }

    if (Array.isArray(data.future_expenses)) {
        for (const item of data.future_expenses) {
            if (item.type === 'duration') {
                if (!item.duration_years || Number.isNaN(Number(item.duration_years)) || item.duration_years <= 0) {
                    errors.push({
                        field: `expense_${item.name || 'unnamed'}`,
                        message: `Duration-based expense "${item.name || '(unnamed)'}" must have a positive duration_years`,
                    });
                }
            }
        }
    }

    return errors;
}