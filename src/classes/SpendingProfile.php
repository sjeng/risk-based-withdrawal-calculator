<?php

/**
 * Spending profile management
 * Implements retirement spending patterns including the "retirement spending smile"
 */
class SpendingProfile {
    private string $profileType;
    private array $customMultipliers = [];
    
    /**
     * Profile types: 'flat', 'smile', 'custom'
     */
    public function __construct(string $profileType = 'smile', array $customMultipliers = []) {
        $validTypes = ['flat', 'smile', 'custom'];
        if (!in_array($profileType, $validTypes)) {
            throw new InvalidArgumentException("Invalid profile type. Must be one of: " . implode(', ', $validTypes));
        }
        
        $this->profileType = $profileType;
        $this->customMultipliers = $customMultipliers;
    }
    
    /**
     * Get spending multiplier for a given age
     * 
     * @param int $age Current age
     * @param int $retirementAge Age at retirement
     * @return float Multiplier (1.0 = 100% of initial spending)
     */
    public function getSpendingMultiplier(int $age, int $retirementAge): float {
        switch ($this->profileType) {
            case 'flat':
                return $this->getFlatMultiplier($age);
                
            case 'smile':
                return $this->getSmileMultiplier($age, $retirementAge);
                
            case 'custom':
                return $this->getCustomMultiplier($age);
                
            default:
                return 1.0;
        }
    }
    
    /**
     * Flat spending profile - constant real spending throughout retirement
     */
    private function getFlatMultiplier(int $age): float {
        return 1.0;
    }
    
    /**
     * Retirement spending smile profile
     * Based on research by David Blanchett and cited in Kitce's work
     * 
     * Pattern:
     * - Early retirement (65-70): Highest spending (100%)
     * - Middle retirement (71-85): Gradual decline
     * - Late retirement (86+): Stabilized lower spending
     */
    private function getSmileMultiplier(int $age, int $retirementAge): float {
        // Years since retirement
        $yearsSinceRetirement = $age - $retirementAge;
        
        // Early retirement: maintain 100% spending for first 5 years
        if ($yearsSinceRetirement <= 5) {
            return 1.00;
        }
        
        // Ages 6-10 years into retirement: Slight decline to 95%
        if ($yearsSinceRetirement <= 10) {
            return 1.00 - (($yearsSinceRetirement - 5) * 0.01);
        }
        
        // Ages 11-20 years into retirement: Gradual decline to 85%
        if ($yearsSinceRetirement <= 20) {
            return 0.95 - (($yearsSinceRetirement - 10) * 0.01);
        }
        
        // Ages 21-30 years into retirement: Slower decline to 80%
        if ($yearsSinceRetirement <= 30) {
            return 0.85 - (($yearsSinceRetirement - 20) * 0.005);
        }
        
        // Ages 31+ years into retirement: Maintain at 80%
        return 0.80;
    }
    
    /**
     * Custom spending profile based on user-defined multipliers
     */
    private function getCustomMultiplier(int $age): float {
        // If exact age specified, use it
        if (isset($this->customMultipliers[$age])) {
            return $this->customMultipliers[$age];
        }
        
        // Otherwise, interpolate between nearest ages
        return $this->interpolateMultiplier($age);
    }
    
    /**
     * Interpolate multiplier for custom profile
     */
    private function interpolateMultiplier(int $age): float {
        if (empty($this->customMultipliers)) {
            return 1.0;
        }
        
        $ages = array_keys($this->customMultipliers);
        sort($ages);
        
        // If age is before first defined age, use first multiplier
        if ($age <= $ages[0]) {
            return $this->customMultipliers[$ages[0]];
        }
        
        // If age is after last defined age, use last multiplier
        if ($age >= end($ages)) {
            return $this->customMultipliers[end($ages)];
        }
        
        // Find surrounding ages and interpolate
        $lowerAge = null;
        $upperAge = null;
        
        foreach ($ages as $definedAge) {
            if ($definedAge <= $age) {
                $lowerAge = $definedAge;
            }
            if ($definedAge >= $age && $upperAge === null) {
                $upperAge = $definedAge;
            }
        }
        
        if ($lowerAge === null || $upperAge === null) {
            return 1.0;
        }
        
        // Linear interpolation
        $lowerMultiplier = $this->customMultipliers[$lowerAge];
        $upperMultiplier = $this->customMultipliers[$upperAge];
        
        $ratio = ($age - $lowerAge) / ($upperAge - $lowerAge);
        return $lowerMultiplier + ($ratio * ($upperMultiplier - $lowerMultiplier));
    }
    
    /**
     * Get profile type
     */
    public function getProfileType(): string {
        return $this->profileType;
    }
    
    /**
     * Get all spending multipliers for a range of ages (for charting)
     */
    public function getMultipliersForRange(int $startAge, int $endAge, int $retirementAge): array {
        $multipliers = [];
        for ($age = $startAge; $age <= $endAge; $age++) {
            $multipliers[$age] = $this->getSpendingMultiplier($age, $retirementAge);
        }
        return $multipliers;
    }
    
    /**
     * Calculate total spending for a specific year
     */
    public function calculateYearSpending(
        float $initialSpending,
        int $currentAge,
        int $retirementAge,
        float $inflationRate,
        int $yearNumber
    ): float {
        // Get spending multiplier for current age
        $multiplier = $this->getSpendingMultiplier($currentAge, $retirementAge);
        
        // Apply inflation to initial spending
        $inflationAdjustedSpending = $initialSpending * pow(1 + $inflationRate, $yearNumber);
        
        // Apply spending profile multiplier
        return $inflationAdjustedSpending * $multiplier;
    }
}
