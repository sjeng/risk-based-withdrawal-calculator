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

---

## 5. Enhanced Monte Carlo: Mean-Reverting Returns

### The Problem with Standard Monte Carlo

The standard Monte Carlo simulation in this calculator (and in most financial planning software) draws each year's return **independently** from a normal distribution. This i.i.d. (independent and identically distributed) assumption introduces a subtle but important bias.

Research by Kitces, Fitzpatrick & Tharp ([2022](https://www.kitces.com/blog/monte-carlo-simulation-historical-returns-sequence-risk-calculate-sustainable-spending-levels/)) compared standard Monte Carlo results against historical rolling-period simulations and found:

- **At typical confidence levels (70–90% probability of success)**, standard Monte Carlo **overstates sustainable income by 5–10%** compared to historical simulation.
- This occurs because real markets exhibit **mean reversion** — prolonged downturns are historically followed by recoveries, and prolonged booms are followed by corrections — but i.i.d. Monte Carlo allows "lucky" recovery streaks that artificially rescue moderate-risk scenarios.
- Conversely, at the extreme tails (0–4% spending risk / 96–100% PoS), Monte Carlo **understates** sustainable income by generating implausibly long sequences of poor returns that have never occurred historically — again because it lacks mean reversion.

**Critically, this calculator's guardrail thresholds (80–95% PoS) land squarely in the zone where standard MC is most over-optimistic.**

### The Enhanced Monte Carlo Approach

The enhanced mode applies two targeted, evidence-based corrections:

#### 1. Log-Normal Returns with Geometric-Mean Centering

Instead of drawing returns from $r \sim \mathcal{N}(\mu, \sigma)$, enhanced mode uses log-normal returns:

$$r_t = e^{X_t} - 1, \quad X_t \sim \mathcal{N}(\mu_{log}, \sigma_{log})$$

Where the log-space parameters are:

$$\sigma_{log} = \sqrt{\ln\left(1 + \frac{\sigma^2}{(1+\mu)^2}\right)}, \quad \mu_{log} = \ln(1+\mu) - \sigma_{log}^2$$

Standard MC uses each period's **arithmetic mean** ($\mu$) as the expected return. But actual compound growth tracks the **geometric mean**, which is always lower — by approximately $\sigma^2 / 2$ — due to volatility drag. The enhanced model centers on this geometric mean by applying the **full** $\sigma_{log}^2$ volatility-drag penalty (rather than the $\sigma_{log}^2 / 2$ that would preserve the arithmetic mean).

The result:
- Expected per-period return drops from $\mu$ to approximately $\mu - \sigma^2 / (2(1+\mu)^2)$
- Higher-volatility portfolios are penalized more (e.g., ~1.1% for 80/20 vs ~0.3% for 40/60)
- Eliminates the theoretical impossibility of returns below $-100\%$
- Produces PoS estimates more consistent with historical backtesting results

#### 2. AR(1) Autocorrelation (Mean Reversion)

Enhanced mode adds first-order autoregressive dynamics in log-return space:

$$X_t = \mu_{log} + \phi \cdot (X_{t-1} - \mu_{log}) + \sigma_\epsilon \cdot z_t$$

Where:
- $\phi$ is the autocorrelation coefficient (negative = mean-reverting)
- $\sigma_\epsilon = \sigma_{log} \sqrt{1 - \phi^2}$ preserves the unconditional variance
- $z_t \sim \mathcal{N}(0, 1)$ is the innovation term

**Default: $\phi = -0.10$** — a conservative estimate from the empirical range of -0.05 to -0.20 for annual equity returns (Poterba & Summers 1988, Fama & French 1988).

### Why AR(1) Instead of Regime-Based Monte Carlo?

The Kitces article also discusses **regime-based Monte Carlo** (assuming a decade of low returns followed by recovery). While effective, regime-based approaches require choosing **subjective near-term return assumptions** — essentially predicting whether we're currently in a "good" or "bad" regime. This is highly dependent on current market conditions and requires frequent recalibration.

AR(1) mean reversion is a **structural property of markets** that applies regardless of the current regime. It requires no crystal ball and no subjective near-term return forecasts, making it a more durable and objective correction.

### How to Interpret the Comparison

When enhanced mode is enabled, both simulations run side-by-side:

| Scenario | What it Means |
| :--- | :--- |
| Enhanced PoS is modestly lower (3–7 points) | Typical result. The geometric-mean centering and autocorrelation produce a more conservative estimate. The enhanced result is closer to what historical simulations would suggest. |
| Both PoS values are close (< 2 points apart) | The spending level is low enough (or income sources large enough) that the return reduction has little impact on failure risk. |
| Enhanced PoS is much lower (> 10 points) | The spending level is aggressive enough that the volatility-drag penalty is material. Consider the enhanced result more seriously. |
| Setting φ = 0 | Disables mean reversion, leaving only the geometric-mean correction. Results should be meaningfully lower than standard MC for equity-heavy portfolios. |
