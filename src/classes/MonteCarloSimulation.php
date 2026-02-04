<?php

require_once __DIR__ . '/ReturnGenerator.php';
require_once __DIR__ . '/CashFlowModel.php';

/**
 * Monte Carlo simulation engine for retirement planning
 * Core of the risk-based guardrail calculator
 */
class MonteCarloSimulation {
    private ReturnGenerator $returnGenerator;
    private CashFlowModel $cashFlowModel;
    private array $config;
    
    // Asset allocation
    private float $stockAllocation;
    private float $bondAllocation;
    private float $cashAllocation;
    
    // Portfolio parameters
    private float $currentPortfolioValue;
    private float $annualFeePercentage;
    
    // Simulation parameters
    private int $iterations;
    private int $planningHorizonYears;
    private int $currentAge;
    private int $retirementAge;
    private float $desiredSpending;
    
    // Results storage
    private array $simulationResults = [];
    private int $successfulIterations = 0;
    private int $failedIterations = 0;
    
    public function __construct(
        CashFlowModel $cashFlowModel,
        float $currentPortfolioValue,
        float $desiredSpending,
        int $currentAge,
        int $retirementAge,
        int $planningHorizonYears,
        float $stockAllocation,
        float $bondAllocation,
        float $cashAllocation,
        float $annualFeePercentage = 0.0075,
        int $iterations = 10000
    ) {
        $this->config = require __DIR__ . '/../config/config.php';
        $this->returnGenerator = new ReturnGenerator();
        $this->cashFlowModel = $cashFlowModel;
        
        $this->currentPortfolioValue = $currentPortfolioValue;
        $this->desiredSpending = $desiredSpending;
        $this->currentAge = $currentAge;
        $this->retirementAge = $retirementAge;
        $this->planningHorizonYears = $planningHorizonYears;
        
        $this->stockAllocation = $stockAllocation;
        $this->bondAllocation = $bondAllocation;
        $this->cashAllocation = $cashAllocation;
        $this->annualFeePercentage = $annualFeePercentage;
        
        $this->validateIterations($iterations);
        $this->iterations = $iterations;
        
        $this->validateAllocations();
    }
    
    /**
     * Validate Monte Carlo iterations count
     */
    private function validateIterations(int $iterations): void {
        $min = $this->config['monte_carlo']['min_iterations'];
        $max = $this->config['monte_carlo']['max_iterations'];
        
        if ($iterations < $min || $iterations > $max) {
            throw new InvalidArgumentException(
                "Iterations must be between {$min} and {$max}"
            );
        }
    }
    
    /**
     * Validate asset allocations sum to 100%
     */
    private function validateAllocations(): void {
        $total = $this->stockAllocation + $this->bondAllocation + $this->cashAllocation;
        if (abs($total - 100.0) > 0.01) {
            throw new InvalidArgumentException(
                "Asset allocations must sum to 100%. Current total: {$total}%"
            );
        }
    }
    
    /**
     * Run Monte Carlo simulation
     * 
     * @return array Results including probability of success and percentile data
     */
    public function runSimulation(): array {
        $startTime = microtime(true);
        
        $this->simulationResults = [];
        $this->successfulIterations = 0;
        $this->failedIterations = 0;
        
        // Run all iterations
        for ($i = 0; $i < $this->iterations; $i++) {
            $iterationResult = $this->runSingleIteration();
            $this->simulationResults[] = $iterationResult;
            
            if ($iterationResult['success']) {
                $this->successfulIterations++;
            } else {
                $this->failedIterations++;
            }
        }
        
        $endTime = microtime(true);
        $durationMs = round(($endTime - $startTime) * 1000);
        
        // Calculate results
        $probabilityOfSuccess = ($this->successfulIterations / $this->iterations) * 100;
        
        return [
            'probability_of_success' => round($probabilityOfSuccess, 2),
            'iterations' => $this->iterations,
            'successful' => $this->successfulIterations,
            'failed' => $this->failedIterations,
            'duration_ms' => $durationMs,
            'percentiles' => $this->calculatePercentiles(),
            'yearly_percentiles' => $this->calculateYearlyPercentiles(),
        ];
    }
    
    /**
     * Run a single Monte Carlo iteration
     * 
     * @return array Iteration results including success/failure and yearly portfolio values
     */
    private function runSingleIteration(): array {
        $portfolioValue = $this->currentPortfolioValue;
        $yearlyValues = [];
        $success = true;
        $depletionYear = null;
        
        for ($year = 0; $year < $this->planningHorizonYears; $year++) {
            $age = $this->currentAge + $year;
            
            // Generate random return for this year
            $annualReturn = $this->returnGenerator->generateReturn(
                $this->stockAllocation,
                $this->bondAllocation,
                $this->cashAllocation
            );
            
            // Apply investment return to beginning portfolio value
            $portfolioValue *= (1 + $annualReturn);
            
            // Subtract fees
            $portfolioValue *= (1 - $this->annualFeePercentage);
            
            // Get spending for this year
            $spending = $this->cashFlowModel->getSpendingForYear(
                $this->desiredSpending,
                $age,
                $this->retirementAge,
                $year
            );
            
            // Get income for this year
            $income = $this->cashFlowModel->getIncomeForYear($age, $year);
            
            // Calculate net withdrawal
            $netWithdrawal = $spending - $income;
            
            // Apply withdrawal (or contribution if negative)
            $portfolioValue -= $netWithdrawal;
            
            // Check for depletion
            if ($portfolioValue <= 0) {
                $success = false;
                $depletionYear = $year;
                $portfolioValue = 0;
            }
            
            $yearlyValues[] = [
                'year' => $year,
                'age' => $age,
                'portfolio_value' => $portfolioValue,
                'annual_return' => $annualReturn,
                'spending' => $spending,
                'income' => $income,
                'net_withdrawal' => $netWithdrawal,
            ];
            
            // If portfolio depleted, stop projecting
            if (!$success) {
                break;
            }
        }
        
        return [
            'success' => $success,
            'final_portfolio_value' => $portfolioValue,
            'depletion_year' => $depletionYear,
            'yearly_values' => $yearlyValues,
        ];
    }
    
    /**
     * Calculate percentiles of final portfolio values
     */
    private function calculatePercentiles(): array {
        $finalValues = array_map(function($result) {
            return $result['final_portfolio_value'];
        }, $this->simulationResults);
        
        sort($finalValues);
        
        return [
            'p10' => $this->getPercentile($finalValues, 10),
            'p25' => $this->getPercentile($finalValues, 25),
            'p50' => $this->getPercentile($finalValues, 50), // Median
            'p75' => $this->getPercentile($finalValues, 75),
            'p90' => $this->getPercentile($finalValues, 90),
            'min' => min($finalValues),
            'max' => max($finalValues),
        ];
    }
    
    /**
     * Calculate percentiles for each year (for charting)
     */
    private function calculateYearlyPercentiles(): array {
        $yearlyPercentiles = [];
        
        for ($year = 0; $year < $this->planningHorizonYears; $year++) {
            $yearValues = [];
            
            foreach ($this->simulationResults as $result) {
                // Get portfolio value for this year if it exists
                if (isset($result['yearly_values'][$year])) {
                    $yearValues[] = $result['yearly_values'][$year]['portfolio_value'];
                } else {
                    // Portfolio was depleted before this year
                    $yearValues[] = 0;
                }
            }
            
            sort($yearValues);
            
            $yearlyPercentiles[] = [
                'year' => $year,
                'age' => $this->currentAge + $year,
                'p10' => $this->getPercentile($yearValues, 10),
                'p25' => $this->getPercentile($yearValues, 25),
                'p50' => $this->getPercentile($yearValues, 50),
                'p75' => $this->getPercentile($yearValues, 75),
                'p90' => $this->getPercentile($yearValues, 90),
            ];
        }
        
        return $yearlyPercentiles;
    }
    
    /**
     * Get percentile value from sorted array
     */
    private function getPercentile(array $sortedValues, float $percentile): float {
        $count = count($sortedValues);
        if ($count === 0) {
            return 0;
        }
        
        $index = ($percentile / 100) * ($count - 1);
        $lower = floor($index);
        $upper = ceil($index);
        
        if ($lower === $upper) {
            return $sortedValues[$lower];
        }
        
        // Linear interpolation
        $weight = $index - $lower;
        return $sortedValues[$lower] * (1 - $weight) + $sortedValues[$upper] * $weight;
    }
    
    /**
     * Get all simulation results (for detailed analysis)
     */
    public function getAllResults(): array {
        return $this->simulationResults;
    }
    
    /**
     * Get expected portfolio return (deterministic)
     */
    public function getExpectedReturn(): float {
        return $this->returnGenerator->getExpectedReturn(
            $this->stockAllocation,
            $this->bondAllocation,
            $this->cashAllocation
        );
    }
    
    /**
     * Get portfolio volatility
     */
    public function getPortfolioVolatility(): float {
        return $this->returnGenerator->getPortfolioVolatility(
            $this->stockAllocation,
            $this->bondAllocation,
            $this->cashAllocation
        );
    }
}
