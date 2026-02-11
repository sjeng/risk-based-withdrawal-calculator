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
- **Future Expenses**: Model planned one-time or recurring expenses over the horizon.
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

Enhanced mode runs a second simulation using log-normal returns with AR(1) mean reversion. This helps model sequence effects more conservatively by allowing downturns to be followed by recoveries and vice versa. Results are shown side-by-side with the standard MC run for comparison. The mean reversion strength is controlled by an autocorrelation coefficient (default -0.10).

## Usage

### Basic Calculation

1. Navigate to http://localhost:8080
2. Enter your retirement parameters:
   - Current age and retirement age
   - Planning horizon (years)
   - Current portfolio value
   - Desired annual spending
   - Asset allocation (stocks/bonds/cash)
   - Fees and inflation assumptions
3. Add income sources (Social Security, pensions, etc.)
4. Add future expenses (one-time or recurring)
5. Select spending profile (flat or retirement smile)
6. Configure guardrail thresholds (defaults: 80% lower, 95% upper, 90% target)
7. Optional: enable Enhanced Monte Carlo and adjust mean reversion strength
8. Click "Calculate" to run Monte Carlo simulation

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
├── cli/                     # Node 24 CLI (see CLI Usage below)
│   ├── guardrail.js          # CLI entry point
│   ├── validate.js           # Input validation
│   ├── package.json          # ESM config, no runtime deps
│   ├── example-input.json    # Sample input for testing
│   └── schemas/
│       ├── input-schema.json  # JSON Schema for input
│       └── output-schema.json # JSON Schema for output
├── docker/                  # Docker configuration
│   └── nginx/               # Nginx web server
├── docs/                    # Web-accessible files
│   ├── index.html            # Main calculator interface
│   ├── css/                  # Stylesheets
│   └── js/                   # JavaScript
│       └── logic/            # Core simulation logic (shared by web & CLI)
└── docker-compose.yml
```

## CLI Usage

The CLI runs the same calculation engine as the browser app under Node.js >= 24, with zero npm dependencies.

### Quick Start

```bash
cd cli
node guardrail.js --input example-input.json --pretty
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--input <file>` | `-i` | Read JSON input from a file (default: stdin) |
| `--enhanced` | `-e` | Also run enhanced Monte Carlo (mean-reverting returns) |
| `--pretty` | `-p` | Pretty-print JSON output |
| `--schema <type>` | `-s` | Print JSON Schema (`input` or `output`) and exit |
| `--help` | `-h` | Show help message |

### Examples

```bash
# Run calculation from file
node guardrail.js --input params.json --pretty

# Pipe from stdin
cat params.json | node guardrail.js --enhanced --pretty

# View the input JSON Schema
node guardrail.js --schema input

# View the output JSON Schema
node guardrail.js --schema output

# Use in a pipeline
node guardrail.js -i params.json | jq '.results.probability_of_success'
```

### Input Format

See `node guardrail.js --schema input` for the full JSON Schema. Key fields:

- `spouse1_age` or `current_age` (required) — current age of primary person
- `retirement_age` (required) — must be ≤ current age
- `planning_horizon_years` (required, 1–60)
- `current_portfolio_value` (required, > 0)
- `desired_spending` (required, ≥ 0)
- `stock_allocation`, `bond_allocation`, `cash_allocation` (required, must sum to 100)
- `annual_fee_percentage` — decimal, default 0.0075 (0.75%)
- `inflation_rate` — decimal, default 0.025 (2.5%)
- `income_sources` — array of future income streams
- `future_expenses` — array of planned expenses

### Output Format

JSON with `results` (always) and `enhancedResults` (when enhanced MC is enabled). See `node guardrail.js --schema output` for the full schema. Key fields:

- `probability_of_success` — % of simulations where portfolio survived
- `guardrail_status` — `above_upper`, `within_range`, or `below_lower`
- `recommended_spending` — adjusted spending targeting the target PoS
- `monte_carlo.percentiles` — final portfolio value distribution

### Error Handling

- Validation errors are emitted to stderr as `{"error": "..."}` with exit code 1
- Calculator warnings (e.g. unusual planning horizon) go to stderr as plain text
- Successful runs exit with code 0

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
