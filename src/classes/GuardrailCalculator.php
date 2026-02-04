<?php

require_once __DIR__ . '/MonteCarloSimulation.php';
require_once __DIR__ . '/CashFlowModel.php';
require_once __DIR__ . '/SpendingProfile.php';

/**
 * Main Guardrail Calculator
 * Implements Kitce's risk-based guardrails using Monte Carlo probability of success
 */
class GuardrailCalculator {
    private array $config;
    
    // Guardrail thresholds
    private float $lowerGuardrailPos;
    private float $upperGuardrailPos;
    private float $targetPos;
    private float $spendingAdjustmentPercentage;
    
    public function __construct(
        float $lowerGuardrailPos = null,
        float $upperGuardrailPos = null,
        float $targetPos = null,
        float $spendingAdjustmentPercentage = null
    ) {
        $this->config = require __DIR__ . '/../config/config.php';
        
        // Use provided values or defaults from config
        $this->lowerGuardrailPos = $lowerGuardrailPos ?? $this->config['guardrails']['default_lower'];
        $this->upperGuardrailPos = $upperGuardrailPos ?? $this->config['guardrails']['default_upper'];
        $this->targetPos = $targetPos ?? $this->config['guardrails']['default_target'];
        $this->spendingAdjustmentPercentage = $spendingAdjustmentPercentage ?? $this->config['guardrails']['default_adjustment'];
        
        $this->validateGuardrails();
    }
    
    /**
     * Validate guardrail thresholds
     */
    private function validateGuardrails(): void {
        if ($this->lowerGuardrailPos >= $this->upperGuardrailPos) {
            throw new InvalidArgumentException(
                "Lower guardrail must be less than upper guardrail"
            );
        }
        
        if ($this->targetPos < $this->lowerGuardrailPos || $this->targetPos > $this->upperGuardrailPos) {
            throw new InvalidArgumentException(
                "Target PoS must be between lower and upper guardrails"
            );
        }
        
        $minLower = $this->config['guardrails']['min_lower'];
        $maxUpper = $this->config['guardrails']['max_upper'];
        
        if ($this->lowerGuardrailPos < $minLower) {
            throw new InvalidArgumentException("Lower guardrail cannot be less than {$minLower}%");
        }
        
        if ($this->upperGuardrailPos > $maxUpper) {
            throw new InvalidArgumentException("Upper guardrail cannot exceed {$maxUpper}%");
        }
    }
    
    /**
     * Calculate retirement recommendation using risk-based guardrails
     * 
     * @param array $params Input parameters
     * @return array Calculation results
     */
    public function calculate(array $params): array {
        $startTime = microtime(true);
        
        // Extract and validate parameters
        $this->validateParams($params);
        
        // Create spending profile
        $spendingProfile = $this->createSpendingProfile($params);
        
        // Create cash flow model
        $cashFlowModel = new CashFlowModel(
            $spendingProfile,
            $params['inflation_rate']
        );
        
        // Add income sources
        if (isset($params['income_sources']) && is_array($params['income_sources'])) {
            foreach ($params['income_sources'] as $source) {
                $cashFlowModel->addIncomeSource(
                    $source['name'],
                    $source['annual_amount'],
                    $source['start_age'],
                    $source['end_age'] ?? null,
                    $source['inflation_adjusted'] ?? true
                );
            }
        }
        
        // Create and run Monte Carlo simulation
        $currentAge = $params['spouse1_age'] ?? $params['current_age'];
        
        $simulation = $this->createSimulation($params, $cashFlowModel, $params['current_spending'], $currentAge);
        $mcResults = $simulation->runSimulation();
        
        // Determine guardrail status and recommendations
        $probabilityOfSuccess = $mcResults['probability_of_success'];
        $guardrailStatus = $this->determineGuardrailStatus($probabilityOfSuccess);
        $spendingAdjustment = $this->determineSpendingAdjustment($guardrailStatus);
        
        // Calculate recommended spending using target-seeking approach if needed
        if ($spendingAdjustment === 'maintain') {
             $recommendedSpending = $params['current_spending'];
        } else {
             $recommendedSpending = $this->findSpendingForTargetPos(
                 $params, 
                 $cashFlowModel, 
                 $spendingAdjustment, 
                 $currentAge
             );
        }
        
        // Calculate current withdrawal rate
        $currentWithdrawalRate = ($params['current_spending'] / $params['current_portfolio_value']) * 100;
        
        $endTime = microtime(true);
        $totalDurationMs = round(($endTime - $startTime) * 1000);
        
        return [
            'probability_of_success' => $probabilityOfSuccess,
            'guardrail_status' => $guardrailStatus,
            'spending_adjustment_needed' => $spendingAdjustment,
            'current_spending' => $params['current_spending'],
            'recommended_spending' => $recommendedSpending,
            'spending_change_amount' => $recommendedSpending - $params['current_spending'],
            'spending_change_percentage' => $this->calculatePercentageChange(
                $params['current_spending'],
                $recommendedSpending
            ),
            'current_withdrawal_rate' => round($currentWithdrawalRate, 2),
            'guardrail_thresholds' => [
                'lower' => $this->lowerGuardrailPos,
                'upper' => $this->upperGuardrailPos,
                'target' => $this->targetPos,
            ],
            'monte_carlo' => $mcResults,
            'portfolio_metrics' => [
                'current_value' => $params['current_portfolio_value'],
                'initial_value' => $params['initial_portfolio_value'],
                'change_since_retirement' => $params['current_portfolio_value'] - $params['initial_portfolio_value'],
                'expected_return' => round($simulation->getExpectedReturn() * 100, 2),
                'portfolio_volatility' => round($simulation->getPortfolioVolatility() * 100, 2),
            ],
            'calculation_duration_ms' => $totalDurationMs,
        ];
    }

    /**
     * Create a simulation instance with given parameters
     */
    private function createSimulation(array $params, CashFlowModel $cashFlowModel, float $spending, int $currentAge, int $iterations = null): MonteCarloSimulation {
        return new MonteCarloSimulation(
            $cashFlowModel,
            $params['current_portfolio_value'],
            $spending,
            $currentAge,
            $params['retirement_age'],
            $params['planning_horizon_years'],
            $params['stock_allocation'],
            $params['bond_allocation'],
            $params['cash_allocation'],
            $params['annual_fee_percentage'],
            $iterations ?? $params['monte_carlo_iterations']
        );
    }

    /**
     * Find the spending amount that results in the target probability of success
     */
    private function findSpendingForTargetPos(
        array $params, 
        CashFlowModel $cashFlowModel, 
        string $adjustmentDirection,
        int $currentAge
    ): float {
        $targetPos = $this->targetPos;
        $tolerance = 0.5; // Accept within 0.5% of target
        $maxIterations = 12; // Binary search depth
        $searchSimIterations = 1000; // Lower precision for search
        
        $currentSpending = $params['current_spending'];
        
        if ($adjustmentDirection === 'decrease') {
            $low = 0;
            $high = $currentSpending;
        } else {
            $low = $currentSpending;
            // Cap drastic increases at reasonable 20% withdrawal rate or just double spending
            // A 100% SWR is technically possible to simulate but practically useless.
            // Let's cap at Current Portfolio / 5 (20% withdrawal rate) as an upper bound sanity check
            $high = max($currentSpending * 2, $params['current_portfolio_value'] / 5);
        }
        
        $bestSpending = $currentSpending;
        $closestPosDiff = 100.0;
        
        for ($i = 0; $i < $maxIterations; $i++) {
            $midSpending = ($low + $high) / 2;
            
            // Should not go below 0
            if ($midSpending < 0) $midSpending = 0;
            
            $sim = $this->createSimulation($params, $cashFlowModel, $midSpending, $currentAge, $searchSimIterations);
            $results = $sim->runSimulation();
            $pos = $results['probability_of_success'];
            
            $diff = abs($pos - $targetPos);
            if ($diff < $closestPosDiff) {
                $closestPosDiff = $diff;
                $bestSpending = $midSpending;
            }
            
            if ($diff <= $tolerance) {
                break;
            }
            
            if ($pos < $targetPos) {
                // Spending too high, need to decrease
                $high = $midSpending;
            } else {
                // Spending too low (PoS > Target), can increase
                $low = $midSpending;
            }
        }
        
        // Final verification run with full iterations on the best finding
        // This is optional but good to ensure the result is robust
        // However, if we change the result based on this, we might deviate again.
        // Let's just return the best found. Round to nearest $10.
        return round($bestSpending / 10) * 10;
    }
    
    /**
     * Determine guardrail status based on probability of success
     */
    private function determineGuardrailStatus(float $probabilityOfSuccess): string {
        if ($probabilityOfSuccess > $this->upperGuardrailPos) {
            return 'above_upper';
        } elseif ($probabilityOfSuccess < $this->lowerGuardrailPos) {
            return 'below_lower';
        } else {
            return 'within_range';
        }
    }
    
    /**
     * Determine spending adjustment based on guardrail status
     */
    private function determineSpendingAdjustment(string $guardrailStatus): string {
        switch ($guardrailStatus) {
            case 'above_upper':
                return 'increase';
            case 'below_lower':
                return 'decrease';
            default:
                return 'maintain';
        }
    }
    
    /**
     * Calculate percentage change between two values
     */
    private function calculatePercentageChange(float $original, float $new): float {
        if ($original == 0) {
            return 0;
        }
        return round((($new - $original) / $original) * 100, 2);
    }
    
    /**
     * Create spending profile from parameters
     */
    private function createSpendingProfile(array $params): SpendingProfile {
        $profileType = $params['spending_profile_type'] ?? 'smile';
        $customMultipliers = $params['custom_spending_multipliers'] ?? [];
        
        return new SpendingProfile($profileType, $customMultipliers);
    }
    
    /**
     * Validate input parameters
     */
    private function validateParams(array $params): void {
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
                throw new InvalidArgumentException("Missing required parameter: {$field}");
            }
        }
        
        // Require either current_age OR spouse1_age
        if (!isset($params['current_age']) && !isset($params['spouse1_age'])) {
            throw new InvalidArgumentException("Missing required parameter: current_age or spouse1_age");
        }
        
        // Use spouse1_age if available, fallback to current_age for backward compatibility
        $currentAge = $params['spouse1_age'] ?? $params['current_age'];
        
        // Validate age parameters
        if ($currentAge < $params['retirement_age']) {
            throw new InvalidArgumentException("Current age must be greater than or equal to age at retirement");
        }
        
        if ($params['planning_horizon_years'] < 1 || $params['planning_horizon_years'] > 60) {
            throw new InvalidArgumentException("Planning horizon must be between 1 and 60 years");
        }
        
        // Validate portfolio values
        if ($params['current_portfolio_value'] <= 0) {
            throw new InvalidArgumentException("Current portfolio value must be positive");
        }
        
        if ($params['initial_portfolio_value'] <= 0) {
            throw new InvalidArgumentException("Initial portfolio value must be positive");
        }
        
        if ($params['current_spending'] < 0) {
            throw new InvalidArgumentException("Current spending cannot be negative");
        }
        
        // Validate allocations
        $totalAllocation = $params['stock_allocation'] + $params['bond_allocation'] + $params['cash_allocation'];
        if (abs($totalAllocation - 100) > 0.01) {
            throw new InvalidArgumentException("Asset allocations must sum to 100%");
        }
        
        // Set defaults for optional parameters
        $params['annual_fee_percentage'] = $params['annual_fee_percentage'] ?? $this->config['defaults']['annual_fee'];
        $params['inflation_rate'] = $params['inflation_rate'] ?? $this->config['defaults']['inflation_rate'];
        $params['monte_carlo_iterations'] = $params['monte_carlo_iterations'] ?? $this->config['monte_carlo']['default_iterations'];
    }
    
    /**
     * Get guardrail configuration
     */
    public function getGuardrailConfig(): array {
        return [
            'lower_guardrail' => $this->lowerGuardrailPos,
            'upper_guardrail' => $this->upperGuardrailPos,
            'target_pos' => $this->targetPos,
            'spending_adjustment' => $this->spendingAdjustmentPercentage,
        ];
    }
    
    /**
     * Generate interpretation message for results
     */
    public function generateInterpretation(array $results): string {
        $pos = $results['probability_of_success'];
        $status = $results['guardrail_status'];
        
        $messages = [
            'above_upper' => "Your probability of success ({$pos}%) is above the upper guardrail ({$this->upperGuardrailPos}%). " .
                           "Your portfolio is performing significantly better than needed. " .
                           "To return to your target confidence level of {$this->targetPos}%, you could increase your annual spending by " .
                           number_format(abs($results['spending_change_amount']), 0) . " to " .
                           number_format($results['recommended_spending'], 0) . ".",
            
            'below_lower' => "Your probability of success ({$pos}%) is below the lower guardrail ({$this->lowerGuardrailPos}%). " .
                            "Your portfolio is at risk of depletion. " .
                            "To restore your target confidence level of {$this->targetPos}%, you should decrease your annual spending by " .
                            number_format(abs($results['spending_change_amount']), 0) . " to " .
                            number_format($results['recommended_spending'], 0) . ".",
            
            'within_range' => "Your probability of success ({$pos}%) is within the safe zone " .
                             "({$this->lowerGuardrailPos}% - {$this->upperGuardrailPos}%). " .
                             "Your current spending of " . number_format($results['current_spending'], 0) . " is sustainable. " .
                             "No adjustment is needed at this time.",
        ];
        
        return $messages[$status];
    }
}
