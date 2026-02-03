-- Migration: Add spouse fields and auto-save functionality
-- Run this if database already exists

USE guardrail_calculator;

-- 1. Add spouse fields to calculations table (check first)
SET @exist_spouse1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'guardrail_calculator' 
  AND TABLE_NAME = 'calculations' 
  AND COLUMN_NAME = 'spouse1_age');

SET @exist_spouse2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'guardrail_calculator' 
  AND TABLE_NAME = 'calculations' 
  AND COLUMN_NAME = 'spouse2_age');

SET @sqlstmt1 := IF(@exist_spouse1 = 0,
  'ALTER TABLE `calculations` ADD COLUMN `spouse1_age` INT NULL AFTER `current_age`',
  'SELECT "Column spouse1_age already exists" AS message');

PREPARE stmt1 FROM @sqlstmt1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @sqlstmt2 := IF(@exist_spouse2 = 0,
  'ALTER TABLE `calculations` ADD COLUMN `spouse2_age` INT NULL AFTER `spouse1_age`',
  'SELECT "Column spouse2_age already exists" AS message');

PREPARE stmt2 FROM @sqlstmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Make current_age nullable for backward compatibility
ALTER TABLE `calculations` 
  MODIFY COLUMN `current_age` INT NULL COMMENT 'Deprecated: use spouse1_age';

-- 2. Add recipient to income_sources (check first)
SET @exist_recipient := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'guardrail_calculator' 
  AND TABLE_NAME = 'income_sources' 
  AND COLUMN_NAME = 'recipient');

SET @sqlstmt3 := IF(@exist_recipient = 0,
  'ALTER TABLE `income_sources` ADD COLUMN `recipient` ENUM("household", "spouse1", "spouse2") NOT NULL DEFAULT "household" AFTER `source_name`',
  'SELECT "Column recipient already exists" AS message');

PREPARE stmt3 FROM @sqlstmt3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 3. Create saved_inputs table
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

-- 4. Create saved_income_sources table
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
