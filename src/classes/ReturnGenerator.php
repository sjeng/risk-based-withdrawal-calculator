<?php

/**
 * Return generator for Monte Carlo simulation
 * Generates random returns based on asset allocation and historical statistics
 */
class ReturnGenerator {
    private array $config;
    private array $returnAssumptions;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../config/config.php';
        $this->returnAssumptions = $this->config['return_assumptions'];
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
        
        // Convert percentages to decimals
        $stockWeight = $stockAllocation / 100.0;
        $bondWeight = $bondAllocation / 100.0;
        $cashWeight = $cashAllocation / 100.0;
        
        // Generate returns for each asset class
        $stockReturn = $this->generateNormalReturn(
            $this->returnAssumptions['stocks']['mean'],
            $this->returnAssumptions['stocks']['std_dev']
        );
        
        $bondReturn = $this->generateNormalReturn(
            $this->returnAssumptions['bonds']['mean'],
            $this->returnAssumptions['bonds']['std_dev']
        );
        
        $cashReturn = $this->generateNormalReturn(
            $this->returnAssumptions['cash']['mean'],
            $this->returnAssumptions['cash']['std_dev']
        );
        
        // Calculate weighted portfolio return
        $portfolioReturn = (
            $stockWeight * $stockReturn +
            $bondWeight * $bondReturn +
            $cashWeight * $cashReturn
        );
        
        return $portfolioReturn;
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
     * Simplified calculation assuming no correlation
     */
    public function getPortfolioVolatility(
        float $stockAllocation,
        float $bondAllocation,
        float $cashAllocation
    ): float {
        $stockWeight = $stockAllocation / 100.0;
        $bondWeight = $bondAllocation / 100.0;
        $cashWeight = $cashAllocation / 100.0;
        
        // Simplified variance (assuming zero correlation)
        $variance = (
            pow($stockWeight * $this->returnAssumptions['stocks']['std_dev'], 2) +
            pow($bondWeight * $this->returnAssumptions['bonds']['std_dev'], 2) +
            pow($cashWeight * $this->returnAssumptions['cash']['std_dev'], 2)
        );
        
        return sqrt($variance);
    }
}
