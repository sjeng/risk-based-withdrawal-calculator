# Validation Report: Monte Carlo Engine

## Executive Summary
The Monte Carlo engine has been reviewed. While the basic structure is sound, there are two significant implementation issues that affect the accuracy of the results:
1.  **Risk Underestimation:** The model assumes zero correlation between asset classes (stocks, bonds, cash).
2.  **Inflation Inconsistency:** Income sources are not correctly adjusted for inflation from "today's dollars" to the start date.

## Detailed Findings

### 1. Zero Correlation Assumption (Risk Underestimation)
**File:** `src/classes/ReturnGenerator.php`
**Issue:** The `generateReturn` method treats asset class returns as independent random variables.
**Impact:** In the real world, asset classes often move together (covariance). By assuming zero correlation, the model significantly underestimates portfolio volatility.
-   Independent variance: $\sigma_p^2 = \sum w_i^2 \sigma_i^2$
-   Actual variance: $\sigma_p^2 = \sum \sum w_i w_j \sigma_i \sigma_j \rho_{ij}$
**Recommendation:** Implement a correlation matrix and use it to calculate portfolio variance.

### 2. Income Inflation Logic
**File:** `src/classes/CashFlowModel.php`
**Issue:** The `getIncomeForYear` method only applies inflation for years *after* the income start age.
```php
$yearsSinceStart = max(0, $currentAge - $source['start_age']);
```
**Impact:** If a user inputs a future income stream (e.g., Social Security starting in 10 years) in "Today's Dollars", the model fails to inflate it for the first 10 years. The purchasing power of that income is significantly undervalued when it finally starts.
**Recommendation:** Adjust logic to inflate from the simulation start year (Today) rather than the income start year, assuming inputs are in Today's Dollars.

### 3. Arithmetic vs. Geometric Mean
**Status:** **Correct**
The simulation correctly draws annual returns from an arithmetic distribution and compounds them. This naturally generates the log-normal distribution of final wealth expected from geometric compounding. The input assumptions (Mean/StdDev) should be interpreted as Arithmetic parameters (1-year horizon), which is standard.

## Next Steps
I will proceed to fix the Risk Underestimation and Income Inflation issues.
