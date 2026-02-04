<?php

/**
 * Cash flow model for retirement income planning
 * Handles income sources, spending, and portfolio withdrawals
 */
class CashFlowModel {
    private array $incomeSources = [];
    private SpendingProfile $spendingProfile;
    private float $inflationRate;
    
    /**
     * @param SpendingProfile $spendingProfile Spending pattern over time
     * @param float $inflationRate Annual inflation rate (as decimal)
     */
    public function __construct(SpendingProfile $spendingProfile, float $inflationRate = 0.025) {
        $this->spendingProfile = $spendingProfile;
        $this->inflationRate = $inflationRate;
    }
    
    /**
     * Add an income source (Social Security, pension, etc.)
     * 
     * @param string $name Source name
     * @param float $annualAmount Annual amount in today's dollars
     * @param int $startAge Age when income begins
     * @param int|null $endAge Age when income ends (null = continues indefinitely)
     * @param bool $inflationAdjusted Whether income adjusts for inflation
     */
    public function addIncomeSource(
        string $name,
        float $annualAmount,
        int $startAge,
        ?int $endAge = null,
        bool $inflationAdjusted = true
    ): void {
        $this->incomeSources[] = [
            'name' => $name,
            'annual_amount' => $annualAmount,
            'start_age' => $startAge,
            'end_age' => $endAge,
            'inflation_adjusted' => $inflationAdjusted,
        ];
    }
    
    /**
     * Get total income for a specific year
     * 
     * @param int $currentAge Current age
     * @param int $yearNumber Year number (0-indexed from retirement)
     * @return float Total income for the year
     */
    public function getIncomeForYear(int $currentAge, int $yearNumber): float {
        $totalIncome = 0.0;
        
        foreach ($this->incomeSources as $source) {
            // Check if income source is active at this age
            if ($currentAge < $source['start_age']) {
                continue;
            }
            
            if ($source['end_age'] !== null && $currentAge > $source['end_age']) {
                continue;
            }
            
            // Calculate income amount
            $amount = $source['annual_amount'];
            
            // Apply inflation if applicable
            if ($source['inflation_adjusted']) {
                $yearsSinceStart = max(0, $currentAge - $source['start_age']);
                $amount *= pow(1 + $this->inflationRate, $yearsSinceStart);
            }
            
            $totalIncome += $amount;
        }
        
        return $totalIncome;
    }
    
    /**
     * Get spending for a specific year
     * 
     * @param float $initialSpending Initial annual spending
     * @param int $currentAge Current age
     * @param int $retirementAge Age at retirement
     * @param int $yearNumber Year number (0-indexed from retirement)
     * @return float Total spending for the year
     */
    public function getSpendingForYear(
        float $initialSpending,
        int $currentAge,
        int $retirementAge,
        int $yearNumber
    ): float {
        return $this->spendingProfile->calculateYearSpending(
            $initialSpending,
            $currentAge,
            $retirementAge,
            $this->inflationRate,
            $yearNumber
        );
    }
    
    /**
     * Calculate net portfolio withdrawal needed for a year
     * (spending minus income = withdrawal needed from portfolio)
     * 
     * @param float $spending Total spending for year
     * @param float $income Total income for year
     * @return float Net withdrawal needed (positive = withdrawal, negative = contribution)
     */
    public function getNetWithdrawal(float $spending, float $income): float {
        return $spending - $income;
    }
    
    /**
     * Get all income sources
     */
    public function getIncomeSources(): array {
        return $this->incomeSources;
    }
    
    /**
     * Clear all income sources (useful for testing/reset)
     */
    public function clearIncomeSources(): void {
        $this->incomeSources = [];
    }
    
    /**
     * Project cash flows over planning horizon
     * Returns array of year-by-year cash flows
     * 
     * @param float $initialSpending Initial annual spending
     * @param int $retirementAge Age at retirement
     * @param int $planningHorizonYears Number of years to project
     * @return array Array of cash flows by year
     */
    public function projectCashFlows(
        float $initialSpending,
        int $retirementAge,
        int $planningHorizonYears
    ): array {
        $cashFlows = [];
        
        for ($year = 0; $year < $planningHorizonYears; $year++) {
            $currentAge = $retirementAge + $year;
            
            $spending = $this->getSpendingForYear(
                $initialSpending,
                $currentAge,
                $retirementAge,
                $year
            );
            
            $income = $this->getIncomeForYear($currentAge, $year);
            $netWithdrawal = $this->getNetWithdrawal($spending, $income);
            
            $cashFlows[] = [
                'year' => $year,
                'age' => $currentAge,
                'spending' => $spending,
                'income' => $income,
                'net_withdrawal' => $netWithdrawal,
                'spending_multiplier' => $this->spendingProfile->getSpendingMultiplier($currentAge, $retirementAge),
            ];
        }
        
        return $cashFlows;
    }
    
    /**
     * Get spending profile
     */
    public function getSpendingProfile(): SpendingProfile {
        return $this->spendingProfile;
    }
    
    /**
     * Update inflation rate
     */
    public function setInflationRate(float $inflationRate): void {
        if ($inflationRate < -0.10 || $inflationRate > 0.20) {
            throw new InvalidArgumentException("Inflation rate must be between -10% and 20%");
        }
        $this->inflationRate = $inflationRate;
    }
    
    /**
     * Get inflation rate
     */
    public function getInflationRate(): float {
        return $this->inflationRate;
    }
}
