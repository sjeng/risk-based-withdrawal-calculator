-- Risk-Based Guardrail Calculator Database Schema (SQLite)
-- Based on Kitce's Risk-Based Monte Carlo Probability of Success Guardrails

-- Enable foreign key support (required in SQLite)
PRAGMA foreign_keys = ON;

-- Users table (for future multi-user support)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session ON users(session_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Main calculations table
CREATE TABLE IF NOT EXISTS calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  calculation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Personal information
  current_age INTEGER, -- Deprecated: use spouse1_age
  spouse1_age INTEGER,
  spouse2_age INTEGER,
  retirement_age INTEGER NOT NULL,
  planning_horizon_years INTEGER NOT NULL,
  
  -- Portfolio values
  initial_portfolio_value REAL NOT NULL,
  current_portfolio_value REAL NOT NULL,
  current_annual_spending REAL NOT NULL,
  
  -- Asset allocation (must sum to 100)
  stock_allocation REAL NOT NULL,
  bond_allocation REAL NOT NULL,
  cash_allocation REAL NOT NULL,
  
  -- Fees and inflation
  annual_fee_percentage REAL NOT NULL DEFAULT 0.0000,
  assumed_inflation_rate REAL NOT NULL DEFAULT 2.5000,
  
  -- Guardrail settings
  lower_guardrail_pos REAL NOT NULL DEFAULT 80.00,
  upper_guardrail_pos REAL NOT NULL DEFAULT 95.00,
  target_pos REAL NOT NULL DEFAULT 90.00,
  spending_adjustment_percentage REAL NOT NULL DEFAULT 10.00,
  
  -- Spending profile
  spending_profile_type TEXT NOT NULL DEFAULT 'smile' CHECK(spending_profile_type IN ('flat', 'smile', 'custom')),
  
  -- Results
  probability_of_success REAL NOT NULL,
  recommended_annual_spending REAL NOT NULL,
  spending_adjustment_needed TEXT NOT NULL CHECK(spending_adjustment_needed IN ('increase', 'decrease', 'maintain')),
  guardrail_status TEXT NOT NULL CHECK(guardrail_status IN ('above_upper', 'within_range', 'below_lower')),
  current_withdrawal_rate REAL,
  
  -- Monte Carlo details
  monte_carlo_iterations INTEGER NOT NULL DEFAULT 2000,
  successful_iterations INTEGER NOT NULL,
  failed_iterations INTEGER NOT NULL,
  median_final_portfolio REAL,
  percentile_10_final REAL,
  percentile_25_final REAL,
  percentile_75_final REAL,
  percentile_90_final REAL,
  
  -- Execution metadata
  calculation_duration_ms INTEGER,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calculation_date ON calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_user_date ON calculations(user_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_pos ON calculations(probability_of_success);

-- Income sources table (Social Security, pensions, etc.)
CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_id INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT 'household' CHECK(recipient IN ('household', 'spouse1', 'spouse2')),
  annual_amount REAL NOT NULL,
  start_age INTEGER NOT NULL,
  end_age INTEGER, -- NULL means continues until end of planning horizon
  is_inflation_adjusted INTEGER DEFAULT 1,
  source_order INTEGER NOT NULL DEFAULT 0,
  
  FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_income_calculation ON income_sources(calculation_id);

-- Custom spending adjustments table (for custom spending profile)
CREATE TABLE IF NOT EXISTS spending_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_id INTEGER NOT NULL,
  age INTEGER NOT NULL,
  spending_multiplier REAL NOT NULL, -- 1.0000 = no change, 0.9000 = 10% reduction
  
  FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spending_calculation_age ON spending_adjustments(calculation_id, age);

-- Monte Carlo percentile results over time (for charting)
CREATE TABLE IF NOT EXISTS monte_carlo_percentiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_id INTEGER NOT NULL,
  year_number INTEGER NOT NULL,
  age INTEGER NOT NULL,
  percentile_10 REAL,
  percentile_25 REAL,
  percentile_50 REAL,
  percentile_75 REAL,
  percentile_90 REAL,
  
  FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_percentiles_calculation_year ON monte_carlo_percentiles(calculation_id, year_number);

-- Historical return data (optional: for storing actual historical returns)
CREATE TABLE IF NOT EXISTS historical_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  stock_return REAL NOT NULL,
  bond_return REAL NOT NULL,
  cash_return REAL NOT NULL,
  inflation_rate REAL NOT NULL
);

-- Insert some sample historical returns data (simplified, representative data)
INSERT OR REPLACE INTO historical_returns (year, stock_return, bond_return, cash_return, inflation_rate) VALUES
(2020, 0.1840, 0.0750, 0.0050, 0.0120),
(2021, 0.2889, -0.0154, 0.0050, 0.0470),
(2022, -0.1811, -0.1309, 0.0150, 0.0650),
(2023, 0.2643, 0.0546, 0.0450, 0.0320);

-- Saved inputs table (single row - always REPLACE INTO)
CREATE TABLE IF NOT EXISTS saved_inputs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Personal information
  spouse1_age INTEGER,
  spouse2_age INTEGER,
  retirement_age INTEGER,
  planning_horizon_years INTEGER,
  
  -- Portfolio values
  initial_portfolio_value REAL,
  current_portfolio_value REAL,
  current_annual_spending REAL,
  
  -- Asset allocation
  stock_allocation REAL,
  bond_allocation REAL,
  cash_allocation REAL,
  
  -- Fees and inflation
  annual_fee_percentage REAL,
  assumed_inflation_rate REAL,
  
  -- Guardrail settings
  lower_guardrail_pos REAL,
  upper_guardrail_pos REAL,
  spending_adjustment_percentage REAL,
  
  -- Spending profile
  spending_profile_type TEXT,
  
  -- Metadata
  last_saved DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (id = 1)
);

-- Trigger to update last_saved timestamp
CREATE TRIGGER IF NOT EXISTS update_saved_inputs_timestamp 
AFTER UPDATE ON saved_inputs
BEGIN
  UPDATE saved_inputs SET last_saved = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Saved income sources (deleted and re-inserted on each save)
CREATE TABLE IF NOT EXISTS saved_income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT,
  recipient TEXT NOT NULL DEFAULT 'household' CHECK(recipient IN ('household', 'spouse1', 'spouse2')),
  annual_amount REAL,
  start_age INTEGER,
  end_age INTEGER,
  is_inflation_adjusted INTEGER DEFAULT 1,
  source_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_saved_income_order ON saved_income_sources(source_order);
