export class CashFlowModel {
    /**
     * @param {SpendingProfile} spendingProfile 
     * @param {number} inflationRate 
     */
    constructor(spendingProfile, inflationRate = 0.025) {
        this.spendingProfile = spendingProfile;
        this.inflationRate = inflationRate;
        this.incomeSources = [];
        this.expenseItems = [];
    }

    addIncomeSource(name, annualAmount, startAge, endAge = null, inflationAdjusted = true) {
        this.incomeSources.push({
            name,
            annual_amount: annualAmount,
            start_age: startAge,
            end_age: endAge,
            inflation_adjusted: inflationAdjusted
        });
    }

    addExpenseItem(name, annualAmount, startAge, endAge = null, inflationAdjusted = true, oneTime = false) {
        this.expenseItems.push({
            name,
            annual_amount: annualAmount,
            start_age: startAge,
            end_age: endAge,
            inflation_adjusted: inflationAdjusted,
            one_time: oneTime
        });
    }

    getIncomeForYear(currentAge, yearNumber) {
        let totalIncome = 0.0;

        for (const source of this.incomeSources) {
            // Check if income source is active at this age
            if (currentAge < source.start_age) {
                continue;
            }

            if (source.end_age !== null && currentAge > source.end_age) {
                continue;
            }

            // Calculate income amount
            let amount = source.annual_amount;

            // Apply inflation if applicable
            if (source.inflation_adjusted) {
                amount *= Math.pow(1 + this.inflationRate, yearNumber);
            }

            totalIncome += amount;
        }

        return totalIncome;
    }

    getExpensesForYear(currentAge, yearNumber) {
        let totalExpenses = 0.0;

        for (const item of this.expenseItems) {
            if (currentAge < item.start_age) {
                continue;
            }

            if (item.one_time) {
                if (currentAge !== item.start_age) {
                    continue;
                }
            } else if (item.end_age !== null && currentAge > item.end_age) {
                continue;
            }

            let amount = item.annual_amount;

            if (item.inflation_adjusted) {
                amount *= Math.pow(1 + this.inflationRate, yearNumber);
            }

            totalExpenses += amount;
        }

        return totalExpenses;
    }

    getSpendingForYear(initialSpending, currentAge, retirementAge, yearNumber) {
        return this.spendingProfile.calculateYearSpending(
            initialSpending,
            currentAge,
            retirementAge,
            this.inflationRate,
            yearNumber
        );
    }
}
