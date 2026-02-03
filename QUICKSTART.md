# 🚀 Quick Start Guide

## Risk-Based Guardrail Calculator - Setup Complete!

Your application is now built and running! Here's everything you need to know.

## ✅ What's Running

All Docker containers are up and running:
- **Nginx** web server on port 8080
- **PHP 8.2-FPM** with all required extensions
- **MySQL 8.0** database on port 3306
- **Adminer** database admin on port 8081

## 🌐 Access Your Application

### Main Calculator
**URL**: http://localhost:8080

Open this in your browser to start using the Risk-Based Guardrail Calculator.

### Database Administration
**URL**: http://localhost:8081
- **System**: MySQL
- **Server**: mysql
- **Username**: guardrail_user
- **Password**: guardrail_pass
- **Database**: guardrail_calculator

### PHP Info (for testing)
**URL**: http://localhost:8080/phpinfo.php

## 🎯 First Calculation Example

Try these sample values:
- **Current Age**: 67
- **Retirement Age**: 65  
- **Planning Horizon**: 30 years
- **Initial Portfolio**: $1,000,000
- **Current Portfolio**: $1,050,000
- **Current Spending**: $45,000/year
- **Asset Allocation**: 60% stocks, 35% bonds, 5% cash
- **Fees**: 0.75%
- **Inflation**: 2.5%

Add an income source:
- **Name**: Social Security
- **Amount**: $30,000/year
- **Start Age**: 70
- **Inflation Adjusted**: Yes

Click "Run Monte Carlo Simulation" and wait ~2-3 seconds for results.

## 🔧 Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f php
docker-compose logs -f nginx
docker-compose logs -f mysql
```

### Stop the Application
```bash
docker-compose stop
```

### Start the Application
```bash
docker-compose start
```

### Restart After Code Changes
```bash
docker-compose restart php nginx
```

### Completely Rebuild
```bash
docker-compose down
docker-compose up -d --build
```

### Stop and Remove Everything (INCLUDING DATA)
```bash
docker-compose down -v
```

## 📁 Project Structure

```
guardrail-calculator/
├── docker-compose.yml          # Container orchestration
├── .env                        # Environment variables
├── README.md                   # Full documentation
├── docker/                     # Docker configurations
│   ├── nginx/                 # Nginx config
│   ├── php/                   # PHP config
│   └── mysql/                 # Database schema
└── src/                       # Application code
    ├── public/                # Web-accessible files
    │   ├── index.php         # Main calculator
    │   ├── api.php           # API endpoint
    │   ├── history.php       # Calculation history
    │   ├── css/              # Styles
    │   └── js/               # JavaScript
    ├── classes/              # PHP business logic
    │   ├── MonteCarloSimulation.php
    │   ├── GuardrailCalculator.php
    │   ├── ReturnGenerator.php
    │   ├── CashFlowModel.php
    │   ├── SpendingProfile.php
    │   └── CalculationRepository.php
    ├── config/               # Configuration
    └── utils/                # Helper functions
```

## 🔍 Testing the Installation

### 1. Check PHP Info
Visit: http://localhost:8080/phpinfo.php

You should see:
- PHP Version 8.2.x
- PDO, PDO_MySQL, MySQLi extensions enabled
- BCMath extension enabled
- Zip extension enabled

### 2. Test Database Connection
Visit: http://localhost:8081

Log in with the credentials above. You should see the `guardrail_calculator` database with these tables:
- `calculations`
- `income_sources`
- `spending_adjustments`
- `monte_carlo_percentiles`
- `historical_returns`
- `users`

### 3. Run a Calculation
Visit: http://localhost:8080

Fill out the form and run a calculation. It should complete in 1-3 seconds and display:
- Probability of Success gauge
- Guardrail status (green/yellow/red)
- Recommended spending
- Monte Carlo projection charts
- Detailed statistics

## 🐛 Troubleshooting

### "Connection Refused" or "Can't Connect"
```bash
# Check if containers are running
docker ps

# If not running, start them
docker-compose up -d

# Check MySQL is ready
docker-compose logs mysql | grep "ready for connections"
```

### "500 Internal Server Error"
```bash
# Check PHP logs
docker-compose logs php

# Check Nginx logs
docker-compose logs nginx

# Verify permissions
docker-compose exec php ls -la /var/www/html
```

### Database Connection Errors
```bash
# Restart MySQL
docker-compose restart mysql

# Wait 10 seconds for MySQL to initialize
sleep 10

# Test connection from PHP container
docker-compose exec php mysql -h mysql -u guardrail_user -pguardrail_pass guardrail_calculator -e "SHOW TABLES;"
```

### Charts Not Displaying
- Make sure you have internet connection (Chart.js loads from CDN)
- Check browser console for JavaScript errors (F12)

## 🔄 Making Changes

### Modify PHP Code
1. Edit files in `src/` directory
2. Restart PHP: `docker-compose restart php`
3. Refresh browser

### Modify HTML/CSS/JavaScript
1. Edit files in `src/public/`
2. Just refresh browser (no restart needed)

### Modify Database Schema
1. Edit `docker/mysql/init.sql`
2. Drop and recreate database:
```bash
docker-compose down -v
docker-compose up -d
```

### Modify Configuration
1. Edit `.env` file
2. Restart services:
```bash
docker-compose down
docker-compose up -d
```

## 📊 Understanding the Results

### Probability of Success (PoS)
The percentage of Monte Carlo simulations where your portfolio lasted the full planning horizon.

### Guardrail Status
- **Above Upper (Green)**: PoS > 95% → Portfolio performing better than expected, consider increasing spending
- **Within Range (Yellow)**: PoS 80-95% → Everything on track, maintain current spending
- **Below Lower (Red)**: PoS < 80% → Portfolio under stress, consider decreasing spending

### Monte Carlo Charts
- **10th Percentile**: Worst 10% of outcomes
- **50th Percentile (Median)**: Middle outcome
- **90th Percentile**: Best 10% of outcomes

## 🚚 Moving to Production/Another Server

1. **Copy entire project directory**
```bash
tar -czf guardrail-calculator.tar.gz guardrail-calculator/
scp guardrail-calculator.tar.gz user@newserver:/path/
```

2. **On new server, extract and start**
```bash
tar -xzf guardrail-calculator.tar.gz
cd guardrail-calculator
docker-compose up -d
```

3. **Your data persists in Docker volume**
- Backup: `docker exec guardrail_mysql mysqldump -u root -proot_password guardrail_calculator > backup.sql`
- Restore: `docker exec -i guardrail_mysql mysql -u root -proot_password guardrail_calculator < backup.sql`

## 📚 Learn More

- **Kitce's Methodology**: https://www.kitces.com/blog/risk-based-monte-carlo-probability-of-success-guardrails-retirement-distribution-hatchet/
- **Full Documentation**: See README.md
- **Calculation History**: http://localhost:8080/history.php

## 🎉 You're Ready!

Your Risk-Based Guardrail Calculator is fully operational and ready to use. Enjoy planning your retirement with confidence!

## Support & Questions

- Check logs: `docker-compose logs`
- Verify setup: Visit http://localhost:8080/phpinfo.php
- Test database: Visit http://localhost:8081
- Review full docs: README.md
