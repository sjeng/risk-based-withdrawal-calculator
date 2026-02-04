<?php

/**
 * Input validation functions
 */

class Validator {
    private array $errors = [];
    
    /**
     * Validate integer field
     */
    public function validateInteger(string $field, $value, int $min = null, int $max = null): bool {
        if (!is_numeric($value) || (int)$value != $value) {
            $this->errors[$field] = "{$field} must be an integer";
            return false;
        }
        
        $intValue = (int)$value;
        
        if ($min !== null && $intValue < $min) {
            $this->errors[$field] = "{$field} must be at least {$min}";
            return false;
        }
        
        if ($max !== null && $intValue > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max}";
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate float field
     */
    public function validateFloat(string $field, $value, float $min = null, float $max = null): bool {
        if (!is_numeric($value)) {
            $this->errors[$field] = "{$field} must be a number";
            return false;
        }
        
        $floatValue = (float)$value;
        
        if ($min !== null && $floatValue < $min) {
            $this->errors[$field] = "{$field} must be at least {$min}";
            return false;
        }
        
        if ($max !== null && $floatValue > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max}";
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate percentage (0-100)
     */
    public function validatePercentage(string $field, $value): bool {
        return $this->validateFloat($field, $value, 0, 100);
    }
    
    /**
     * Validate positive number
     */
    public function validatePositive(string $field, $value): bool {
        if (!is_numeric($value) || $value <= 0) {
            $this->errors[$field] = "{$field} must be a positive number";
            return false;
        }
        return true;
    }
    
    /**
     * Validate non-negative number
     */
    public function validateNonNegative(string $field, $value): bool {
        if (!is_numeric($value) || $value < 0) {
            $this->errors[$field] = "{$field} cannot be negative";
            return false;
        }
        return true;
    }
    
    /**
     * Validate required field
     */
    public function validateRequired(string $field, $value): bool {
        if ($value === null || $value === '') {
            $this->errors[$field] = "{$field} is required";
            return false;
        }
        return true;
    }
    
    /**
     * Validate enum value
     */
    public function validateEnum(string $field, $value, array $allowedValues): bool {
        if (!in_array($value, $allowedValues, true)) {
            $this->errors[$field] = "{$field} must be one of: " . implode(', ', $allowedValues);
            return false;
        }
        return true;
    }
    
    /**
     * Validate array field
     */
    public function validateArray(string $field, $value): bool {
        if (!is_array($value)) {
            $this->errors[$field] = "{$field} must be an array";
            return false;
        }
        return true;
    }
    
    /**
     * Get all errors
     */
    public function getErrors(): array {
        return $this->errors;
    }
    
    /**
     * Check if has errors
     */
    public function hasErrors(): bool {
        return !empty($this->errors);
    }
    
    /**
     * Get first error
     */
    public function getFirstError(): ?string {
        return !empty($this->errors) ? reset($this->errors) : null;
    }
    
    /**
     * Clear errors
     */
    public function clearErrors(): void {
        $this->errors = [];
    }
    
    /**
     * Add custom error
     */
    public function addError(string $field, string $message): void {
        $this->errors[$field] = $message;
    }
}

/**
 * Validate calculation input parameters
 */
function validateCalculationInput(array $params): array {
    $validator = new Validator();
    $errors = [];
    
    // Required fields
    $required = [
        'retirement_age',
        'planning_horizon_years',
        'initial_portfolio_value',
        'current_portfolio_value',
        'current_spending',
        'stock_allocation',
        'bond_allocation',
        'cash_allocation',
    ];
    
    foreach ($required as $field) {
        if (!isset($params[$field])) {
            $errors[$field] = "{$field} is required";
        }
    }
    
    // Require either current_age OR spouse1_age
    if (!isset($params['current_age']) && !isset($params['spouse1_age'])) {
        $errors['spouse1_age'] = "Either current_age or spouse1_age is required";
    }
    
    if (!empty($errors)) {
        return $errors;
    }
    
    // Validate ages
    if (isset($params['spouse1_age'])) {
        $validator->validateInteger('spouse1_age', $params['spouse1_age'], 18, 120);
        $age = $params['spouse1_age'];
    } elseif (isset($params['current_age'])) {
        $validator->validateInteger('current_age', $params['current_age'], 18, 120);
        $age = $params['current_age'];
    }
    
    if (isset($params['spouse2_age'])) {
        $validator->validateInteger('spouse2_age', $params['spouse2_age'], 18, 120);
    }
    
    $validator->validateInteger('retirement_age', $params['retirement_age'], 18, 120);
    $validator->validateInteger('planning_horizon_years', $params['planning_horizon_years'], 1, 60);
    
    // Business logic validations
    if (isset($age) && $age < $params['retirement_age']) {
        $validator->addError('spouse1_age', 'Current age must be greater than or equal to age at retirement');
    }
    
    // Validate portfolio values
    $validator->validatePositive('initial_portfolio_value', $params['initial_portfolio_value']);
    $validator->validatePositive('current_portfolio_value', $params['current_portfolio_value']);
    $validator->validateNonNegative('current_spending', $params['current_spending']);
    
    // Validate asset allocations
    $validator->validatePercentage('stock_allocation', $params['stock_allocation']);
    $validator->validatePercentage('bond_allocation', $params['bond_allocation']);
    $validator->validatePercentage('cash_allocation', $params['cash_allocation']);
    
    // Validate allocation sum
    $totalAllocation = $params['stock_allocation'] + $params['bond_allocation'] + $params['cash_allocation'];
    if (abs($totalAllocation - 100) > 0.01) {
        $validator->addError('allocations', 'Asset allocations must sum to 100%');
    }
    
    // Validate optional fields
    if (isset($params['annual_fee_percentage'])) {
        $validator->validateFloat('annual_fee_percentage', $params['annual_fee_percentage'], 0, 5);
    }
    
    if (isset($params['inflation_rate'])) {
        $validator->validateFloat('inflation_rate', $params['inflation_rate'], -0.10, 0.20);
    }
    
    if (isset($params['monte_carlo_iterations'])) {
        $validator->validateInteger('monte_carlo_iterations', $params['monte_carlo_iterations'], 100, 100000);
    }
    
    if (isset($params['spending_profile_type'])) {
        $validator->validateEnum('spending_profile_type', $params['spending_profile_type'], ['flat', 'smile', 'custom']);
    }
    
    // Validate guardrails if provided
    if (isset($params['lower_guardrail'])) {
        $validator->validateFloat('lower_guardrail', $params['lower_guardrail'], 50, 95);
    }
    
    if (isset($params['upper_guardrail'])) {
        $validator->validateFloat('upper_guardrail', $params['upper_guardrail'], 55, 99);
    }
    
    if (isset($params['spending_adjustment_percentage'])) {
        $validator->validateFloat('spending_adjustment_percentage', $params['spending_adjustment_percentage'], 1, 50);
    }
    
    // Business logic validations
    if (isset($age) && $age < $params['retirement_age']) {
        $validator->addError('spouse1_age', 'Current age must be greater than or equal to age at retirement');
    }
    
    // Validate income sources if provided
    if (isset($params['income_sources']) && is_array($params['income_sources'])) {
        foreach ($params['income_sources'] as $index => $source) {
            if (empty($source['name'])) {
                $validator->addError("income_sources[{$index}][name]", "Income source name is required");
            }
            if (!isset($source['annual_amount']) || $source['annual_amount'] <= 0) {
                $validator->addError("income_sources[{$index}][annual_amount]", "Income amount must be positive");
            }
            if (!isset($source['start_age']) || $source['start_age'] < 0) {
                $validator->addError("income_sources[{$index}][start_age]", "Start age must be specified");
            }
        }
    }
    
    return $validator->getErrors();
}

/**
 * Sanitize calculation input
 */
function sanitizeCalculationInput(array $params): array {
    $sanitized = [];
    
    // Integers
    $intFields = ['current_age', 'spouse1_age', 'spouse2_age', 'retirement_age', 'planning_horizon_years', 'monte_carlo_iterations'];
    foreach ($intFields as $field) {
        if (isset($params[$field])) {
            $sanitized[$field] = (int)$params[$field];
        }
    }
    
    // Floats
    $floatFields = [
        'initial_portfolio_value',
        'current_portfolio_value',
        'current_spending',
        'stock_allocation',
        'bond_allocation',
        'cash_allocation',
        'annual_fee_percentage',
        'inflation_rate',
        'lower_guardrail',
        'upper_guardrail',
        'target_pos',
        'spending_adjustment_percentage',
    ];
    foreach ($floatFields as $field) {
        if (isset($params[$field])) {
            $sanitized[$field] = (float)$params[$field];
        }
    }
    
    // Strings
    if (isset($params['spending_profile_type'])) {
        $sanitized['spending_profile_type'] = trim($params['spending_profile_type']);
    }
    
    // Arrays
    if (isset($params['income_sources']) && is_array($params['income_sources'])) {
        $sanitized['income_sources'] = array_map(function($source) {
            return [
                'name' => trim($source['name'] ?? ''),
                'recipient' => trim($source['recipient'] ?? 'household'),
                'annual_amount' => (float)($source['annual_amount'] ?? 0),
                'start_age' => (int)($source['start_age'] ?? 0),
                'end_age' => isset($source['end_age']) ? (int)$source['end_age'] : null,
                'inflation_adjusted' => filter_var($source['inflation_adjusted'] ?? true, FILTER_VALIDATE_BOOLEAN),
            ];
        }, $params['income_sources']);
    }
    
    if (isset($params['custom_spending_multipliers']) && is_array($params['custom_spending_multipliers'])) {
        $sanitized['custom_spending_multipliers'] = array_map('floatval', $params['custom_spending_multipliers']);
    }
    
    return $sanitized;
}
