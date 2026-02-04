export class SpendingProfile {
    /**
     * @param {string} profileType 'flat', 'smile', 'custom'
     * @param {Object} customMultipliers key-value pairs of age: multiplier
     */
    constructor(profileType = 'smile', customMultipliers = {}) {
        const validTypes = ['flat', 'smile', 'custom'];
        if (!validTypes.includes(profileType)) {
            console.error("Invalid profile type provided: " + profileType + ", defaulting to 'smile'");
            profileType = 'smile';
        }

        this.profileType = profileType;
        this.customMultipliers = customMultipliers;
    }

    /**
     * Get spending multiplier for a given age
     * @param {number} age Current age
     * @param {number} retirementAge Age at retirement
     * @returns {number} Multiplier (1.0 = 100% of initial spending)
     */
    getSpendingMultiplier(age, retirementAge) {
        switch (this.profileType) {
            case 'flat':
                return this.getFlatMultiplier(age);
            case 'smile':
                return this.getSmileMultiplier(age, retirementAge);
            case 'custom':
                return this.getCustomMultiplier(age);
            default:
                return 1.0;
        }
    }

    getFlatMultiplier(age) {
        return 1.0;
    }

    getSmileMultiplier(age, retirementAge) {
        // Years since retirement
        const yearsSinceRetirement = age - retirementAge;

        // Early retirement: maintain 100% spending for first 5 years
        if (yearsSinceRetirement <= 5) {
            return 1.00;
        }

        // Ages 6-10 years into retirement: Slight decline to 95%
        if (yearsSinceRetirement <= 10) {
            return 1.00 - ((yearsSinceRetirement - 5) * 0.01);
        }

        // Ages 11-20 years into retirement: Gradual decline to 85%
        if (yearsSinceRetirement <= 20) {
            return 0.95 - ((yearsSinceRetirement - 10) * 0.01);
        }

        // Ages 21-30 years into retirement: Slower decline to 80%
        if (yearsSinceRetirement <= 30) {
            return 0.85 - ((yearsSinceRetirement - 20) * 0.005);
        }

        // Ages 31+ years into retirement: Maintain at 80%
        return 0.80;
    }

    getCustomMultiplier(age) {
        // Implementation omitted for simplicity as it relies on complex interpolation 
        // and 'custom' type isn't used in default scenarios yet.
        // For a full port, one should implement the interpolation logic if needed.
        if (this.customMultipliers[age] !== undefined) {
            return this.customMultipliers[age];
        }
        return 1.0;
    }

    /**
     * Calculate total spending for a specific year
     * @param {number} initialSpending
     * @param {number} currentAge
     * @param {number} retirementAge
     * @param {number} inflationRate
     * @param {number} yearNumber
     * @returns {number}
     */
    calculateYearSpending(initialSpending, currentAge, retirementAge, inflationRate, yearNumber) {
        // Get spending multiplier for current age
        const multiplier = this.getSpendingMultiplier(currentAge, retirementAge);

        // Apply inflation to initial spending
        const inflationAdjustedSpending = initialSpending * Math.pow(1 + inflationRate, yearNumber);

        // Apply spending profile multiplier
        return inflationAdjustedSpending * multiplier;
    }
}
