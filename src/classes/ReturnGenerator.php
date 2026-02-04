<?php

/**
 * Return generator for Monte Carlo simulation
 * Generates random returns based on asset allocation and historical statistics
 */
class ReturnGenerator {
    private array $config;
    private array $returnAssumptions;
    private array $correlations;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../config/config.php';
        $this->returnAssumptions = $this->config['return_assumptions'];
        $this->correlations = $this->config['correlations'] ?? [
            'stocks_bonds' => 0.0,
            'stocks_cash' => 0.0,
            'bonds_cash' => 0.0,
        ];
    }
    
    /**
     * Generate portfolio return for one year based on asset allocation
     * 
     * @param float $stockAllocation Stock allocation (0-100)
     * @param float $bondAllocation Bond allocation (0-100)
     * @param float $cashAllocation Cash allocation (0-100)
     * @return float Annual portfolio return (as decimal, e.g., 0.08 = 8%)
     */
    public function generateReturn(
        float $stockAllocation,
        float $bondAllocation,
        float $cashAllocation
    ): float {
        // Validate allocations sum to 100
        $total = $stockAllocation + $bondAllocation + $cashAllocation;
        if (abs($total - 100.0) > 0.01) {
            throw new InvalidArgumentException("Asset allocations must sum to 100%");
        }
        
        $portfolioExpectedReturn = $this->getExpectedReturn($stockAllocation, $bondAllocation, $cashAllocation);
        $portfolioVolatility = $this->getPortfolioVolatility($stockAllocation, $bondAllocation, $cashAllocation);
        
        // Generate single portfolio return from aggregated distribution
        return $this->generateNormalReturn($portfolioExpectedReturn, $portfolioVolatility);
    }
    
    /**
     * Generate random return from normal distribution using Box-Muller transform
     * 
     * @param float $mean Mean return
     * @param float $stdDev Standard deviation
     * @return float Random return from normal distribution
     */
    private function generateNormalReturn(float $mean, float $stdDev): float {
        // Box-Muller transform for generating normal distribution
        $u1 = mt_rand(1, mt_getrandmax()) / mt_getrandmax();
        $u2 = mt_rand(1, mt_getrandmax()) / mt_getrandmax();
        
        $z = sqrt(-2.0 * log($u1)) * cos(2.0 * M_PI * $u2);
        
        return $mean + ($stdDev * $z);
    }
    
    /**
     * Get return assumptions for display purposes
     */
    public function getReturnAssumptions(): array {
        return $this->returnAssumptions;
    }
    
    /**
     * Calculate expected portfolio return (non-random, for reference)
     */
    public function getExpectedReturn(
        float $stockAllocation,
        float $bondAllocation,
        float $cashAllocation
    ): float {
        $stockWeight = $stockAllocation / 100.0;
        $bondWeight = $bondAllocation / 100.0;
        $cashWeight = $cashAllocation / 100.0;
        
        return (
            $stockWeight * $this->returnAssumptions['stocks']['mean'] +
            $bondWeight * $this->returnAssumptions['bonds']['mean'] +
            $cashWeight * $this->returnAssumptions['cash']['mean']
        );
    }
    
    /**
     * Calculate portfolio volatility (standard deviation)
     * accounts for correlation between asset classes
     */
    public function getPortfolioVolatility(
        float $stockAllocation,
        float $bondAllocation,
        float $cashAllocation
    ): float {
        $wS = $stockAllocation / 100.0;
        $wB = $bondAllocation / 100.0;
        $wC = $cashAllocation / 100.0;
        
        $sdS = $this->returnAssumptions['stocks']['std_dev'];
        $sdB = $this->returnAssumptions['bonds']['std_dev'];
        $sdC = $this->returnAssumptions['cash']['std_dev'];
        
        $corrSB = $this->correlations['stocks_bonds'] ?? 0.0;
        $corrSC = $this->correlations['stocks_cash'] ?? 0.0;
        $corrBC = $this->correlations['bonds_cash'] ?? 0.0;
        
        // Variance calculation with correlations
        // Var = w1^2*sd1^2 + w2^2*sd2^2 + ... + 2*w1*w2*sd1*sd2*corr12 + ...
        $variance = 
            (pow($wS * $sdS, 2)) +
            (pow($wB * $sdB, 2)) +
            (pow($wC * $sdC, 2)) +
            (2 * $wS * $wB * $sdS * $sdB * $corrSB) +
            (2 * $wS * $wC * $sdS * $sdC * $corrSC) +
            (2 * $wB * $wC * $sdB * $sdC * $corrBC);
            
        return sqrt($variance);
    }
}
