# Risk-Based Guardrail Withdrawal Calculator

A comprehensive client-side JavaScript application implementing Kitce's Risk-Based Monte Carlo Probability of Success Guardrails for retirement distribution planning.

## Overview

This application calculates retirement spending recommendations based on risk-based guardrails using Monte Carlo simulation. Unlike traditional withdrawal-rate guardrails, this approach uses probability of success (PoS) as the risk metric, accounting for:

- Changing longevity expectations as retirees age
- Future cash flows (Social Security, pensions, etc.)
- The retirement distribution "hatchet" (declining spending over time)
- Asset allocation and fees
- Inflation adjustments

## Disclaimer

This calculator is for educational and planning purposes only and does not constitute financial, investment, tax, or legal advice. Results are based on user inputs and assumptions, are not guarantees, and may differ from actual outcomes. Use at your own risk and consult a qualified professional before making financial decisions.

## Features

- **Client-Side Simulation**: 10,000 Monte Carlo iterations run locally in your browser using Web Workers.
- **Risk-Based Guardrails**: Configurable upper/lower PoS thresholds.
- **Retirement Spending Smile**: Model realistic spending patterns over retirement.
- **Enhanced Monte Carlo (Optional)**: Runs a second simulation with mean-reverting returns to compare against standard MC.
- **Multiple Income Sources**: Social Security, pensions, and other income streams.
- **Local Persistence**: Calculation inputs are automatically saved to your browser's Local Storage.
- **Shareable Links**: Inputs are encoded into a compact `state` query param for easy sharing.
- **Interactive Visualizations**: Charts showing Monte Carlo projections and guardrail status.
- **Static Architecture**: No server-side processing or database required.

## Technology Stack

- **Vanilla JavaScript** (ES6+)
- **Web Workers** for background processing
- **Chart.js** for visualizations
- **HTML5 & CSS3**

## Installation & Usage

### Option 1: Docker (Recommended)

Running with Docker ensures all browser security features working correctly (Web Workers, ES Modules).

1.  Start the container:
    ```bash
    docker-compose up -d
    ```
2.  Open your browser to: [http://localhost:8080](http://localhost:8080)

### Option 2: Local Static Server

If you have Python installed, you can run a simple server:
```bash
cd docs
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080).

### Note on File System Access
Opening `docs/index.html` directly (via `file://`) will likely fail in modern browsers due to security restrictions on Web Workers and ES Modules. Please use one of the HTTP server options above.

### Hosting

This is a static website. You can host it on:
- GitHub Pages
- Netlify
- Vercel
- Any standard web server (Apache, Nginx)

### Development

The core logic is located in `docs/js/logic/`. The Web Worker `docs/js/worker.js` handles the simulation execution.

## Methodology

Based on [Kitce's Risk-Based Guardrails](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/) by Derek Tharp and Justin Fitzpatrick.

The calculator performs 10,000 Monte Carlo simulations per run, projecting portfolio growth based on:
- **Stocks**: 10% mean return, 20% std dev
- **Bonds**: 5% mean return, 6% std dev
- **Cash**: 3% mean return, 1% std dev
- **Inflation**: 2.5% (default)

### Enhanced Monte Carlo (Optional)

Enhanced mode runs a second simulation using log-normal returns with AR(1) mean reversion. This helps model sequence effects more conservatively by allowing downturns to be followed by recoveries and vice versa. Results are shown side-by-side with the standard MC run for comparison.

## Usage

### Basic Calculation

1. Navigate to http://localhost:8080
2. Enter your retirement parameters:
   - Current age and retirement age
   - Initial portfolio value (at retirement)
   - Current portfolio value
   - Desired annual spending
   - Asset allocation (stocks/bonds/cash)
3. Add income sources (Social Security, pensions, etc.)
4. Select spending profile (flat or retirement smile)
5. Configure guardrail thresholds (defaults: 80% lower, 95% upper)
6. Click "Calculate" to run Monte Carlo simulation

### Interpreting Results

- **Probability of Success**: Percentage of simulations where portfolio lasted the full planning horizon
- **Guardrail Status**:
  - **Above Upper**: PoS > 95% → Consider increasing spending
  - **Within Range**: PoS between 80-95% → Maintain desired spending
  - **Below Lower**: PoS < 80% → Consider decreasing spending
- **Recommended Spending**: Adjusted spending based on guardrail breach (if any)

## Project Structure

```
risk-based-guardrail/
├── docker/                  # Docker configuration
│   └── nginx/               # Nginx web server
├── docs/                    # Web-accessible files
│   ├── index.html            # Main calculator interface
│   ├── css/                  # Stylesheets
│   └── js/                   # JavaScript
│       └── logic/            # Core simulation logic
└── docker-compose.yml
```

## Methodology

This calculator implements the risk-based guardrails approach described in [Kitce's research](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/).

### Key Concepts

1. **Probability of Success (PoS)**: The percentage of Monte Carlo simulations where the portfolio successfully lasts the entire planning horizon

2. **Risk-Based Guardrails**: Unlike withdrawal-rate guardrails, these use PoS thresholds:
   - Lower guardrail (default 80%): Trigger spending decrease
   - Upper guardrail (default 95%): Trigger spending increase

3. **Retirement Distribution Hatchet**: Spending naturally declines over retirement due to:
   - Social Security claiming (reducing portfolio withdrawals)
   - Natural spending decline with age
   - Healthcare and other changing expenses

4. **Dynamic Adjustments**: Spending recommendations adapt to:
   - Actual investment returns experienced
   - Changing longevity expectations
   - Future income sources
   - Current portfolio value vs. initial plan

## Configuration

### Asset Allocation

Default historical return assumptions:
- **Stocks**: Mean 10%, Std Dev 20%
- **Bonds**: Mean 5%, Std Dev 6%
- **Cash**: Mean 3%, Std Dev 1%

## Docker Commands

### Start containers
```bash
docker-compose up -d
```

### Stop containers
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f
```

### Restart specific service
```bash
docker-compose restart web
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

## Performance Considerations

- Monte Carlo simulations (10,000 iterations) typically complete in under a second on modern hardware
- Runs entirely in the browser with no network overhead

## References

- [Kitce's Risk-Based Guardrails Article](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/) by Derek Tharp and Justin Fitzpatrick
- [Retirement Spending Smile Research](https://www.kitces.com/blog/estimating-changes-in-retirement-expenditures-and-the-retirement-spending-smile/)
- [Guyton-Klinger Withdrawal Rules](https://www.kitces.com/blog/probability-of-success-driven-guardrails-advantages-monte-carlo-simulations-analysis-communication/)

## License

[Specify your license here]
