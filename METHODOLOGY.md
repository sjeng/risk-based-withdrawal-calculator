# Risk-Based Guardrails Methodology

This document details the specific implementation of the **Risk-Based Guardrails** system within this application, based on the research by Michael Kitces.

## Source Material
*   **Article:** [The Ratchet-Hatchet of Risk-Based Monte Carlo Guardrails](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/)
*   **Core Concept:** Managing retirement spending risk using **Probability of Success (PoS)** rather than Withdrawal Rates.

---

## 1. The Core Philosophy

Traditional guardrails often rely on Withdrawal Rates (e.g., "If withdrawal rate hits 6%, cut spending"). Kitces argues this is flawed because it ignores:
*   **Changing Longevity:** A 6% withdrawal rate is dangerous at age 65 but perfectly safe at age 90.
*   **Flexibility:** It doesn't account for future cash flows (Social Security) or changing asset allocations.

**Risk-Based Guardrails** solve this by using the **Probability of Success (PoS)** from a Monte Carlo simulation as the single metric for decision-making.

> **Risk** is defined simply as `100% - Probability of Success`.

---

## 2. Guardrail Thresholds

The calculator supports configurable guardrail thresholds. The UI defaults are set to **80% lower**, **95% upper**, and a **90% target**, and users can adjust them in the form.

If you want to align with the specific thresholds discussed in Kitces's research (70% lower, 99% upper), update the form values accordingly.

| Guardrail | Default Threshold | Application Logic | Meaning |
| :--- | :--- | :--- | :--- |
| **Upper Guardrail** | **95% PoS** | **The Ratchet** | The portfolio is doing very well. Spending can be increased (ratcheted up). |
| **Safe Zone** | **80% - 95%** | **Maintain** | The plan is working. Volatility is normal. |
| **Lower Guardrail** | **< 80% PoS** | **The Hatchet** | The risk of failure becomes too high. A spending cut is required to restore safety. |
| **Target** | **90% PoS** | **The Goal** | When a change is needed, we solve for the spending amount that restores confidence to this level. |

---

## 3. The "Target-Seeking" Adjustment Algorithm

Most calculators apply a "blind cut" (e.g., "PoS is low, cut spending by 10%"). This is arbitrary.

**Our Implementation:**
When a guardrail is breached, the application solves for the **exact dollar amount** required to restore the **Target PoS (90%)**.

### How it works (Code Logic):
1.  **Detection:** User runs simulation. Result is **65% PoS** (Below Lower Limit).
2.  **Solver Loop:** The calculator enters a binary search loop.
    *   *Try 1:* Reduce spending by 50%. (Result: 99% PoS - Too safe)
    *   *Try 2:* Reduce spending by 25%. (Result: 85% PoS - Too low)
    *   *Try 3:* Reduce spending by 40%. (Result: 92% PoS - Close)
    *   *Convergence:* The system iterates until it finds the specific spending amount (e.g., $44,500) that yields **exactly 90% PoS**.
3.  **Recommendation:** The user is told: *"To restore your target confidence level of 90%, decrease annual spending to $44,500."*

This aligns with the principle: **"Solve for the spending level that would bring the probability of success back to the target."**

---

## 4. The Retirement Spending Smile

The application assumes spending does not match inflation perfectly every year. It uses the "Retirement Spending Smile" (modeled in `docs/js/logic/SpendingProfile.js`):
*   **Early Retirement:** High activity/spending.
*   **Mid Retirement:** Gradual real-dollar decline (travel stops, activity slows).
*   **Late Retirement:** Slight uptick for healthcare, but generally lower than active years.

This "Smile" curve is built into the underlying Monte Carlo engine, ensuring the Guardrails are making decisions based on realistic lifelong spending patterns.
