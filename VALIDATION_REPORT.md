# Validation Report: Monte Carlo Engine

## Executive Summary
The Monte Carlo engine has been reviewed. The following implementation issues identified have now been **Resolved**:
1.  **Risk Underestimation:** The model assumed zero correlation between asset classes. (Fixed)
2.  **Inflation Inconsistency:** Income sources were not correctly adjusted for inflation from "today's dollars". (Fixed)

Both issues have been addressed in the code.

## Detailed Findings

### 1. Zero Correlation Assumption (Risk Underestimation)
**Status:** **Fixed**
**File:** `src/classes/ReturnGenerator.php`
**Issue:** The `generateReturn` method treats asset class returns as independent random variables.
**Impact:** In the real world, asset classes often move together (covariance). By assuming zero correlation, the model significantly underestimates portfolio volatility.
-   Independent variance: $\sigma_p^2 = \sum w_i^2 \sigma_i^2$
-   Actual variance: $\sigma_p^2 = \sum \sum w_i w_j \sigma_i \sigma_j \rho_{ij}$
**Resolution:** Implemented a correlation matrix in `config.php` and updated `getPortfolioVolatility` to use the full covariance formula.

### 2. Income Inflation Logic
**Status:** **Fixed**
**File:** `src/classes/CashFlowModel.php`
**Issue:** The `getIncomeForYear` method only applies inflation for years *after* the income start age.
```php
$yearsSinceStart = max(0, $currentAge - $source['start_age']);
```
**Impact:** If a user inputs a future income stream (e.g., Social Security starting in 10 years) in "Today's Dollars", the model fails to inflate it for the first 10 years. The purchasing power of that income is significantly undervalued when it finally starts.
**Resolution:** Adjusted logic to inflate from the simulation start year (`$yearNumber`) rather than the income start year. This assumes all user inputs for future income are expressed in Today's Dollars (Purchasing Power).

### 3. Arithmetic vs. Geometric Mean
**Status:** **Correct**
The simulation correctly draws annual returns from an arithmetic distribution and compounds them. This naturally generates the log-normal distribution of final wealth expected from geometric compounding. The input assumptions (Mean/StdDev) should be interpreted as Arithmetic parameters (1-year horizon), which is standard.

## Next Steps
I will proceed to fix the Risk Underestimation and Income Inflation issues.
