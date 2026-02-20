import { validateInput } from '../docs/js/logic/validateInput.js';

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

    const errors = validateInput(data);
    if (errors.length > 0) {
        return { valid: false, message: errors[0].message };
    }

    return { valid: true };
}
