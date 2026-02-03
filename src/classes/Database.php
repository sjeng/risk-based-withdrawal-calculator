<?php

/**
 * Database connection wrapper using PDO (SQLite)
 */
class Database {
    private static ?PDO $instance = null;
    private array $config;
    
    /**
     * Private constructor to prevent direct instantiation
     */
    private function __construct() {
        $this->config = require __DIR__ . '/../config/config.php';
    }
    
    /**
     * Get singleton database instance
     */
    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $db = new self();
            self::$instance = $db->connect();
        }
        return self::$instance;
    }
    
    /**
     * Create PDO connection to SQLite database
     */
    private function connect(): PDO {
        $dbConfig = $this->config['database'];
        $dbPath = $dbConfig['path'];
        
        // Ensure storage directory exists
        $storageDir = dirname($dbPath);
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0755, true);
        }
        
        $dsn = 'sqlite:' . $dbPath;
        
        try {
            $pdo = new PDO(
                $dsn,
                null,
                null,
                $dbConfig['options']
            );
            
            // Enable foreign keys (required for SQLite)
            $pdo->exec('PRAGMA foreign_keys = ON');
            
            // Initialize database if it's new
            $this->initializeDatabase($pdo);
            
            return $pdo;
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new RuntimeException("Database connection failed. Please check your configuration.");
        }
    }
    
    /**
     * Initialize database schema if tables don't exist
     */
    private function initializeDatabase(PDO $pdo): void {
        // Check if tables exist
        $result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='calculations'");
        
        if ($result->fetch() === false) {
            // Database is empty, initialize with schema
            $initSql = $this->getInitSchema();
            
            // Execute initialization script
            $pdo->exec($initSql);
            error_log("Database initialized with schema");
        }
    }
    
    /**
     * Get database initialization schema
     */
    private function getInitSchema(): string {
        return <<<'SQL'
-- Risk-Based Guardrail Calculator Database Schema (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session ON users(session_id);

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  calculation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  current_age INTEGER,
  spouse1_age INTEGER,
  spouse2_age INTEGER,
  retirement_age INTEGER NOT NULL,
  planning_horizon_years INTEGER NOT NULL,
  initial_portfolio_value REAL NOT NULL,
  current_portfolio_value REAL NOT NULL,
  current_annual_spending REAL NOT NULL,
  stock_allocation REAL NOT NULL,
  bond_allocation REAL NOT NULL,
  cash_allocation REAL NOT NULL,
  annual_fee_percentage REAL NOT NULL DEFAULT 0.0000,
  assumed_inflation_rate REAL NOT NULL DEFAULT 2.5000,
  lower_guardrail_pos REAL NOT NULL DEFAULT 80.00,
  upper_guardrail_pos REAL NOT NULL DEFAULT 95.00,
  target_pos REAL NOT NULL DEFAULT 90.00,
  spending_adjustment_percentage REAL NOT NULL DEFAULT 10.00,
  spending_profile_type TEXT NOT NULL DEFAULT 'smile',
  probability_of_success REAL NOT NULL,
  recommended_annual_spending REAL NOT NULL,
  spending_adjustment_needed TEXT NOT NULL,
  guardrail_status TEXT NOT NULL,
  current_withdrawal_rate REAL,
  monte_carlo_iterations INTEGER NOT NULL DEFAULT 2000,
  successful_iterations INTEGER NOT NULL,
  failed_iterations INTEGER NOT NULL,
  median_final_portfolio REAL,
  percentile_10_final REAL,
  percentile_25_final REAL,
  percentile_75_final REAL,
  percentile_90_final REAL,
  calculation_duration_ms INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calculation_date ON calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_user_date ON calculations(user_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_pos ON calculations(probability_of_success);

CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_id INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT 'household',
  annual_amount REAL NOT NULL,
  start_age INTEGER NOT NULL,
  end_age INTEGER,
  is_inflation_adjusted INTEGER DEFAULT 1,
  source_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_income_calculation ON income_sources(calculation_id);

CREATE TABLE IF NOT EXISTS spending_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_id INTEGER NOT NULL,
  age INTEGER NOT NULL,
  spending_multiplier REAL NOT NULL,
  FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spending_calculation_age ON spending_adjustments(calculation_id, age);

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

CREATE TABLE IF NOT EXISTS historical_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  stock_return REAL NOT NULL,
  bond_return REAL NOT NULL,
  cash_return REAL NOT NULL,
  inflation_rate REAL NOT NULL
);

INSERT OR REPLACE INTO historical_returns (year, stock_return, bond_return, cash_return, inflation_rate) VALUES
(2020, 0.1840, 0.0750, 0.0050, 0.0120),
(2021, 0.2889, -0.0154, 0.0050, 0.0470),
(2022, -0.1811, -0.1309, 0.0150, 0.0650),
(2023, 0.2643, 0.0546, 0.0450, 0.0320);

CREATE TABLE IF NOT EXISTS saved_inputs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  spouse1_age INTEGER,
  spouse2_age INTEGER,
  retirement_age INTEGER,
  planning_horizon_years INTEGER,
  initial_portfolio_value REAL,
  current_portfolio_value REAL,
  current_annual_spending REAL,
  stock_allocation REAL,
  bond_allocation REAL,
  cash_allocation REAL,
  annual_fee_percentage REAL,
  assumed_inflation_rate REAL,
  lower_guardrail_pos REAL,
  upper_guardrail_pos REAL,
  spending_adjustment_percentage REAL,
  spending_profile_type TEXT,
  last_saved DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (id = 1)
);

CREATE TRIGGER IF NOT EXISTS update_saved_inputs_timestamp 
AFTER UPDATE ON saved_inputs
BEGIN
  UPDATE saved_inputs SET last_saved = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS saved_income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT,
  recipient TEXT NOT NULL DEFAULT 'household',
  annual_amount REAL,
  start_age INTEGER,
  end_age INTEGER,
  is_inflation_adjusted INTEGER DEFAULT 1,
  source_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_saved_income_order ON saved_income_sources(source_order);
SQL;
    }
    
    /**
     * Begin transaction
     */
    public static function beginTransaction(): bool {
        return self::getInstance()->beginTransaction();
    }
    
    /**
     * Commit transaction
     */
    public static function commit(): bool {
        return self::getInstance()->commit();
    }
    
    /**
     * Rollback transaction
     */
    public static function rollback(): bool {
        return self::getInstance()->rollBack();
    }
    
    /**
     * Get last insert ID
     */
    public static function lastInsertId(): string {
        return self::getInstance()->lastInsertId();
    }
    
    /**
     * Prevent cloning
     */
    private function __clone() {}
    
    /**
     * Prevent unserialization
     */
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
}
