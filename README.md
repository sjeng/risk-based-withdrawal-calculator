# Risk-Based Guardrail Calculator

A comprehensive client-side JavaScript application implementing Kitce's Risk-Based Monte Carlo Probability of Success Guardrails for retirement distribution planning.

## Overview

This application calculates retirement spending recommendations based on risk-based guardrails using Monte Carlo simulation. Unlike traditional withdrawal-rate guardrails, this approach uses probability of success (PoS) as the risk metric, accounting for:

- Changing longevity expectations as retirees age
- Future cash flows (Social Security, pensions, etc.)
- The retirement distribution "hatchet" (declining spending over time)
- Asset allocation and fees
- Inflation adjustments

## Features

- **Client-Side Simulation**: 10,000 Monte Carlo iterations run locally in your browser using Web Workers.
- **Risk-Based Guardrails**: Configurable upper/lower PoS thresholds.
- **Retirement Spending Smile**: Model realistic spending patterns over retirement.
- **Multiple Income Sources**: Social Security, pensions, and other income streams.
- **Local Persistence**: Calculation inputs are automatically saved to your browser's Local Storage.
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
cd src/public
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080).

### Note on File System Access
Opening `src/public/index.html` directly (via `file://`) will likely fail in modern browsers due to security restrictions on Web Workers and ES Modules. Please use one of the HTTP server options above.

### Hosting

This is a static website. You can host it on:
- GitHub Pages
- Netlify
- Vercel
- Any standard web server (Apache, Nginx)

### Development

The core logic is located in `src/public/js/logic/`. The Web Worker `src/public/js/worker.js` handles the simulation execution.

## Methodology

Based on [Kitce's Risk-Based Guardrails](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/).

The calculator performs 10,000 Monte Carlo simulations per run, projecting portfolio growth based on:
- **Stocks**: 10% mean return, 20% std dev
- **Bonds**: 5% mean return, 6% std dev
- **Cash**: 3% mean return, 1% std dev
- **Inflation**: 2.5% (default)

   ```bash
   docker-compose up -d --build
   ```

3. Access the application:
   - **Main Application**: http://localhost:8080
   - **Calculation History**: http://localhost:8080/history.php
   - **PHP Info**: http://localhost:8080/phpinfo.php

**Note**: The SQLite database is automatically created on first use in `src/storage/database.sqlite`.

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
guardrail-calculator/
├── docker/                    # Docker configuration
│   ├── nginx/                # Nginx web server
│   ├── php/                  # PHP-FPM
│   └── sqlite/               # SQLite initialization
├── src/
│   ├── public/               # Web-accessible files
│   │   ├── index.php        # Main calculator interface
│   │   ├── api.php          # API endpoint
│   │   ├── history.php      # Calculation history
│   │   ├── css/             # Stylesheets
│   │   └── js/              # JavaScript
│   ├── classes/              # PHP classes
│   │   ├── Database.php              
│   │   ├── MonteCarloSimulation.php  # Core MC engine
│   │   ├── GuardrailCalculator.php   # Main calculator
│   │   ├── ReturnGenerator.php       # Return modeling
│   │   ├── CashFlowModel.php         # Cash flow projections
│   │   ├── SpendingProfile.php       # Spending patterns
│   │   ├── CalculationRepository.php # Database operations
│   │   └── SavedInputRepository.php  # Auto-save persistence
│   ├── config/               # Configuration files
│   ├── storage/              # Database and logs
│   │   ├── database.sqlite  # SQLite database (auto-created)
│   │   └── logs/            # Application logs
│   └── utils/                # Utility functions
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

### Environment Variables

Optional environment variables (defaults work out of the box):

```bash
# Database (optional, defaults to src/storage/database.sqlite)
DB_PATH=/var/www/html/storage/database.sqlite

# Application
APP_ENV=development
APP_DEBUG=true
```

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
docker-compose restart php
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

### Access PHP container shell
```bash
docker exec -it guardrail_php sh
```

### Access SQLite database directly
```bash
docker exec -it guardrail_php sqlite3 /var/www/html/storage/database.sqlite
```

## Migration and Portability

To migrate to a new host:

1. Copy entire project directory
2. Run `docker-compose up -d --build`
3. Database file is in `src/storage/database.sqlite` (automatically backed up with volume)

To backup database:
```bash
# Copy from container
docker cp guardrail_php:/var/www/html/storage/database.sqlite ./backup.sqlite

# Or use SQLite dump
docker exec guardrail_php sqlite3 /var/www/html/storage/database.sqlite .dump > backup.sql
```

To restore database:
```bash
# Copy to container
docker cp ./backup.sqlite guardrail_php:/var/www/html/storage/database.sqlite

# Or restore from dump
docker exec -i guardrail_php sqlite3 /var/www/html/storage/database.sqlite < backup.sql
```

## Development

### Adding New Features

1. Create new PHP classes in `src/classes/`
2. Update database schema in `docker/sqlite/init.sql`
3. Add frontend components in `src/public/`
4. Test thoroughly with various scenarios

### Code Standards

- PSR-12 coding standards for PHP
- Object-oriented architecture
- Clear separation of concerns
- Comprehensive error handling
- Input validation and sanitization

## Performance Considerations

- Monte Carlo simulations (10,000 iterations) typically complete in ~600ms
- SQLite is extremely fast for single-user operations
- No network overhead (file-based database)
- Database auto-initializes on first use
- Efficient for read-heavy workloads

## Troubleshooting

### Containers won't start
```bash
docker-compose down
docker-compose up -d --build
```

### Database connection errors
- Check that storage directory has proper permissions
- Verify database file exists: `docker exec guardrail_php ls -la /var/www/html/storage/`
- Check logs: `docker-compose logs php`

### Calculation timeouts
- Increase `max_execution_time` in `docker/php/php.ini`
- Reduce Monte Carlo iterations (not recommended below 1,000)

### Permission issues
```bash
docker-compose exec php chown -R www-data:www-data /var/www/html/storage
```

### View database schema
```bash
docker exec -it guardrail_php sqlite3 /var/www/html/storage/database.sqlite ".schema"
```

### Query database directly
```bash
docker exec -it guardrail_php sqlite3 /var/www/html/storage/database.sqlite
# Then run SQL queries:
# SELECT * FROM calculations ORDER BY calculation_date DESC LIMIT 5;
# .quit to exit
```

## References

- [Kitce's Risk-Based Guardrails Article](https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/)
- [Retirement Spending Smile Research](https://www.kitces.com/blog/estimating-changes-in-retirement-expenditures-and-the-retirement-spending-smile/)
- [Guyton-Klinger Withdrawal Rules](https://www.kitces.com/blog/probability-of-success-driven-guardrails-advantages-monte-carlo-simulations-analysis-communication/)

## License

[Specify your license here]

## Contributing

[Contribution guidelines if applicable]

## Support

[Contact information or support channels]
