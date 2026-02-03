-- Risk-Based Guardrail Calculator Database Schema
-- Based on Kitce's Risk-Based Monte Carlo Probability of Success Guardrails

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- Users table (for future multi-user support)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Main calculations table
CREATE TABLE IF NOT EXISTS `calculations` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `calculation_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Personal information
  `current_age` INT NULL COMMENT 'Deprecated: use spouse1_age',
  `spouse1_age` INT NULL,
  `spouse2_age` INT NULL,
  `retirement_age` INT NOT NULL,
  `planning_horizon_years` INT NOT NULL,
  
  -- Portfolio values
  `initial_portfolio_value` DECIMAL(15,2) NOT NULL,
  `current_portfolio_value` DECIMAL(15,2) NOT NULL,
  `current_annual_spending` DECIMAL(15,2) NOT NULL,
  
  -- Asset allocation (must sum to 100)
  `stock_allocation` DECIMAL(5,2) NOT NULL,
  `bond_allocation` DECIMAL(5,2) NOT NULL,
  `cash_allocation` DECIMAL(5,2) NOT NULL,
  
  -- Fees and inflation
  `annual_fee_percentage` DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  `assumed_inflation_rate` DECIMAL(5,4) NOT NULL DEFAULT 2.5000,
  
  -- Guardrail settings
  `lower_guardrail_pos` DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  `upper_guardrail_pos` DECIMAL(5,2) NOT NULL DEFAULT 95.00,
  `target_pos` DECIMAL(5,2) NOT NULL DEFAULT 90.00,
  `spending_adjustment_percentage` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  
  -- Spending profile
  `spending_profile_type` ENUM('flat', 'smile', 'custom') NOT NULL DEFAULT 'smile',
  
  -- Results
  `probability_of_success` DECIMAL(5,2) NOT NULL,
  `recommended_annual_spending` DECIMAL(15,2) NOT NULL,
  `spending_adjustment_needed` ENUM('increase', 'decrease', 'maintain') NOT NULL,
  `guardrail_status` ENUM('above_upper', 'within_range', 'below_lower') NOT NULL,
  `current_withdrawal_rate` DECIMAL(5,2) NULL,
  
  -- Monte Carlo details
  `monte_carlo_iterations` INT NOT NULL DEFAULT 2000,
  `successful_iterations` INT NOT NULL,
  `failed_iterations` INT NOT NULL,
  `median_final_portfolio` DECIMAL(15,2) NULL,
  `percentile_10_final` DECIMAL(15,2) NULL,
  `percentile_25_final` DECIMAL(15,2) NULL,
  `percentile_75_final` DECIMAL(15,2) NULL,
  `percentile_90_final` DECIMAL(15,2) NULL,
  
  -- Execution metadata
  `calculation_duration_ms` INT NULL,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_calculation_date` (`calculation_date`),
  INDEX `idx_user_date` (`user_id`, `calculation_date`),
  INDEX `idx_pos` (`probability_of_success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Income sources table (Social Security, pensions, etc.)
CREATE TABLE IF NOT EXISTS `income_sources` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `calculation_id` INT UNSIGNED NOT NULL,
  `source_name` VARCHAR(100) NOT NULL,
  `recipient` ENUM('household', 'spouse1', 'spouse2') NOT NULL DEFAULT 'household',
  `annual_amount` DECIMAL(15,2) NOT NULL,
  `start_age` INT NOT NULL,
  `end_age` INT NULL COMMENT 'NULL means continues until end of planning horizon',
  `is_inflation_adjusted` BOOLEAN DEFAULT TRUE,
  `source_order` INT NOT NULL DEFAULT 0,
  
  FOREIGN KEY (`calculation_id`) REFERENCES `calculations`(`id`) ON DELETE CASCADE,
  INDEX `idx_calculation` (`calculation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom spending adjustments table (for custom spending profile)
CREATE TABLE IF NOT EXISTS `spending_adjustments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `calculation_id` INT UNSIGNED NOT NULL,
  `age` INT NOT NULL,
  `spending_multiplier` DECIMAL(5,4) NOT NULL COMMENT '1.0000 = no change, 0.9000 = 10% reduction',
  
  FOREIGN KEY (`calculation_id`) REFERENCES `calculations`(`id`) ON DELETE CASCADE,
  INDEX `idx_calculation_age` (`calculation_id`, `age`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monte Carlo percentile results over time (for charting)
CREATE TABLE IF NOT EXISTS `monte_carlo_percentiles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `calculation_id` INT UNSIGNED NOT NULL,
  `year_number` INT NOT NULL,
  `age` INT NOT NULL,
  `percentile_10` DECIMAL(15,2) NULL,
  `percentile_25` DECIMAL(15,2) NULL,
  `percentile_50` DECIMAL(15,2) NULL,
  `percentile_75` DECIMAL(15,2) NULL,
  `percentile_90` DECIMAL(15,2) NULL,
  
  FOREIGN KEY (`calculation_id`) REFERENCES `calculations`(`id`) ON DELETE CASCADE,
  INDEX `idx_calculation_year` (`calculation_id`, `year_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historical return data (optional: for storing actual historical returns)
CREATE TABLE IF NOT EXISTS `historical_returns` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `year` INT NOT NULL,
  `stock_return` DECIMAL(8,4) NOT NULL,
  `bond_return` DECIMAL(8,4) NOT NULL,
  `cash_return` DECIMAL(8,4) NOT NULL,
  `inflation_rate` DECIMAL(8,4) NOT NULL,
  
  UNIQUE KEY `idx_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample historical returns data (simplified, representative data)
-- Real implementation would include full historical dataset
INSERT INTO `historical_returns` (`year`, `stock_return`, `bond_return`, `cash_return`, `inflation_rate`) VALUES
(2020, 0.1840, 0.0750, 0.0050, 0.0120),
(2021, 0.2889, -0.0154, 0.0050, 0.0470),
(2022, -0.1811, -0.1309, 0.0150, 0.0650),
(2023, 0.2643, 0.0546, 0.0450, 0.0320)
ON DUPLICATE KEY UPDATE
  `stock_return` = VALUES(`stock_return`),
  `bond_return` = VALUES(`bond_return`),
  `cash_return` = VALUES(`cash_return`),
  `inflation_rate` = VALUES(`inflation_rate`);

-- Saved inputs table (single row - always REPLACE INTO)
CREATE TABLE IF NOT EXISTS `saved_inputs` (
  `id` INT UNSIGNED PRIMARY KEY DEFAULT 1,
  
  -- Personal information
  `spouse1_age` INT NULL,
  `spouse2_age` INT NULL,
  `retirement_age` INT NULL,
  `planning_horizon_years` INT NULL,
  
  -- Portfolio values
  `initial_portfolio_value` DECIMAL(15,2) NULL,
  `current_portfolio_value` DECIMAL(15,2) NULL,
  `current_annual_spending` DECIMAL(15,2) NULL,
  
  -- Asset allocation
  `stock_allocation` DECIMAL(5,2) NULL,
  `bond_allocation` DECIMAL(5,2) NULL,
  `cash_allocation` DECIMAL(5,2) NULL,
  
  -- Fees and inflation
  `annual_fee_percentage` DECIMAL(5,4) NULL,
  `assumed_inflation_rate` DECIMAL(5,4) NULL,
  
  -- Guardrail settings
  `lower_guardrail_pos` DECIMAL(5,2) NULL,
  `upper_guardrail_pos` DECIMAL(5,2) NULL,
  `spending_adjustment_percentage` DECIMAL(5,2) NULL,
  
  -- Spending profile
  `spending_profile_type` VARCHAR(20) NULL,
  
  -- Metadata
  `last_saved` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved income sources (deleted and re-inserted on each save)
CREATE TABLE IF NOT EXISTS `saved_income_sources` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `source_name` VARCHAR(100) NULL,
  `recipient` ENUM('household', 'spouse1', 'spouse2') NOT NULL DEFAULT 'household',
  `annual_amount` DECIMAL(15,2) NULL,
  `start_age` INT NULL,
  `end_age` INT NULL,
  `is_inflation_adjusted` BOOLEAN DEFAULT TRUE,
  `source_order` INT NOT NULL DEFAULT 0,
  
  INDEX `idx_order` (`source_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
