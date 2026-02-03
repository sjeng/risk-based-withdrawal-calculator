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

We have implemented the specific "Hatchet" methodology thresholds recommended in the research to avoid "whipsawing" (making frequent, unnecessary adjustments).

| Guardrail | Threshold | Application Logic | Meaning |
| :--- | :--- | :--- | :--- |
| **Upper Guardrail** | **99% PoS** | **The Ratchet** | The portfolio is doing so well that there is essentially *zero* risk of failure. Spending can be increased (ratcheted up). |
| **Safe Zone** | **70% - 99%** | **Maintain** | The plan is working. Even at 75% success, there is no need to panic. Volatility is normal. |
| **Lower Guardrail** | **< 70% PoS** | **The Hatchet** | The risk of failure (30%+) has become too high. A "Hatchet" (spending cut) is required to restore safety. |
| **Target** | **90% PoS** | **The Goal** | When a change is needed, we solve for the spending amount that restores confidence to this level. |

### Why these specific numbers?
*   **70% Lower Limit:** Traditional plans target 75-90% success. If markets drop, PoS falls. Kitces argues one should *not* cut spending immediately. Accessing the "safety margin" (70-90% range) is exactly what it's there for. You only cut when risk becomes "unacceptable" (below 70%).
*   **99% Upper Limit:** Raising spending permanently is a risk. You should only do it when the plan is "bulletproof" (99% success).

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

The application assumes spending does not match inflation perfectly every year. It uses the "Retirement Spending Smile" (modeled in `SpendingProfile.php`):
*   **Early Retirement:** High activity/spending.
*   **Mid Retirement:** Gradual real-dollar decline (travel stops, activity slows).
*   **Late Retirement:** Slight uptick for healthcare, but generally lower than active years.

This "Smile" curve is built into the underlying Monte Carlo engine, ensuring the Guardrails are making decisions based on realistic lifelong spending patterns.
