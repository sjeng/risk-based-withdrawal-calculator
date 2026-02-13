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
        // Blanchett-style retirement spending smile approximation:
        // - Start at 100% real spending at retirement
        // - Decline to ~74.146% by age 84 (for age-65 retiree in cited illustration)
        // - Rebound toward 100% by age 95 due to rising late-life healthcare costs
        const troughAge = 84;
        const reboundAge = 95;
        const troughMultiplier = 0.74146;
        const peakMultiplier = 1.00;

        if (age <= retirementAge) {
            return peakMultiplier;
        }

        if (age <= troughAge) {
            const declineSpan = Math.max(1, troughAge - retirementAge);
            const progress = (age - retirementAge) / declineSpan;
            return peakMultiplier + (troughMultiplier - peakMultiplier) * progress;
        }

        if (age <= reboundAge) {
            const reboundSpan = reboundAge - troughAge;
            const progress = (age - troughAge) / reboundSpan;
            return troughMultiplier + (peakMultiplier - troughMultiplier) * progress;
        }

        // Cap near 100% of initial real spending in very late years.
        return peakMultiplier;
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
