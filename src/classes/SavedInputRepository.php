<?php

require_once __DIR__ . '/Database.php';

/**
 * Repository for saved form inputs (auto-save functionality)
 * Single-user app: Always saves to id=1, always loads from id=1
 */
class SavedInputRepository {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Save form inputs (always replaces existing)
     * @param array $inputs Form input data
     * @return bool Success
     */
    public function saveInputs(array $inputs): bool {
        try {
            Database::beginTransaction();
            
            // INSERT OR REPLACE = INSERT or UPDATE if id=1 exists (SQLite syntax)
            $sql = "INSERT OR REPLACE INTO saved_inputs (
                id,
                spouse1_age, spouse2_age, retirement_age, planning_horizon_years,
                initial_portfolio_value, current_portfolio_value, current_annual_spending,
                stock_allocation, bond_allocation, cash_allocation,
                annual_fee_percentage, assumed_inflation_rate,
                lower_guardrail_pos, upper_guardrail_pos, spending_adjustment_percentage,
                spending_profile_type
            ) VALUES (
                1,
                :spouse1_age, :spouse2_age, :retirement_age, :planning_horizon_years,
                :initial_portfolio_value, :current_portfolio_value, :current_annual_spending,
                :stock_allocation, :bond_allocation, :cash_allocation,
                :annual_fee_percentage, :assumed_inflation_rate,
                :lower_guardrail_pos, :upper_guardrail_pos, :spending_adjustment_percentage,
                :spending_profile_type
            )";
            
            $stmt = $this->db->prepare($sql);
            $params = $this->prepareBindParams($inputs);
            $stmt->execute($params);
            
            // Delete and re-insert income sources
            $this->deleteAllIncomeSources();
            if (isset($inputs['income_sources']) && is_array($inputs['income_sources'])) {
                $this->insertIncomeSources($inputs['income_sources']);
            }
            
            Database::commit();
            return true;
            
        } catch (Exception $e) {
            Database::rollback();
            error_log("Failed to save inputs: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Load saved inputs (always loads id=1)
     * @return array|null Saved inputs or null if none exist
     */
    public function loadInputs(): ?array {
        $sql = "SELECT * FROM saved_inputs WHERE id = 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        
        $inputs = $stmt->fetch();
        
        if (!$inputs) {
            return null;
        }
        
        // Load income sources
        $inputs['income_sources'] = $this->loadIncomeSources();
        
        return $inputs;
    }
    
    /**
     * Check if any saved data exists
     */
    public function hasSavedData(): bool {
        $sql = "SELECT COUNT(*) as count FROM saved_inputs WHERE id = 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch();
        
        return $result['count'] > 0;
    }
    
    /**
     * Clear all saved data
     */
    public function clearInputs(): bool {
        Database::beginTransaction();
        try {
            $this->deleteAllIncomeSources();
            $sql = "DELETE FROM saved_inputs WHERE id = 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            Database::commit();
            return true;
        } catch (Exception $e) {
            Database::rollback();
            return false;
        }
    }
    
    // Private helper methods
    
    private function prepareBindParams(array $inputs): array {
        return [
            ':spouse1_age' => $inputs['spouse1_age'] ?? null,
            ':spouse2_age' => $inputs['spouse2_age'] ?? null,
            ':retirement_age' => $inputs['retirement_age'] ?? null,
            ':planning_horizon_years' => $inputs['planning_horizon_years'] ?? null,
            ':initial_portfolio_value' => $inputs['initial_portfolio_value'] ?? null,
            ':current_portfolio_value' => $inputs['current_portfolio_value'] ?? null,
            ':current_annual_spending' => $inputs['current_spending'] ?? $inputs['current_annual_spending'] ?? null,
            ':stock_allocation' => $inputs['stock_allocation'] ?? null,
            ':bond_allocation' => $inputs['bond_allocation'] ?? null,
            ':cash_allocation' => $inputs['cash_allocation'] ?? null,
            ':annual_fee_percentage' => $inputs['annual_fee_percentage'] ?? null,
            ':assumed_inflation_rate' => $inputs['inflation_rate'] ?? $inputs['assumed_inflation_rate'] ?? null,
            ':lower_guardrail_pos' => $inputs['lower_guardrail'] ?? $inputs['lower_guardrail_pos'] ?? null,
            ':upper_guardrail_pos' => $inputs['upper_guardrail'] ?? $inputs['upper_guardrail_pos'] ?? null,
            ':spending_adjustment_percentage' => $inputs['spending_adjustment_percentage'] ?? null,
            ':spending_profile_type' => $inputs['spending_profile_type'] ?? null,
        ];
    }
    
    private function insertIncomeSources(array $sources): void {
        $sql = "INSERT INTO saved_income_sources (
            source_name, recipient, annual_amount,
            start_age, end_age, is_inflation_adjusted, source_order
        ) VALUES (
            :source_name, :recipient, :annual_amount,
            :start_age, :end_age, :is_inflation_adjusted, :source_order
        )";
        
        $stmt = $this->db->prepare($sql);
        
        foreach ($sources as $index => $source) {
            $stmt->execute([
                ':source_name' => $source['name'] ?? null,
                ':recipient' => $source['recipient'] ?? 'household',
                ':annual_amount' => $source['annual_amount'] ?? null,
                ':start_age' => $source['start_age'] ?? null,
                ':end_age' => $source['end_age'] ?? null,
                ':is_inflation_adjusted' => $source['inflation_adjusted'] ?? true,
                ':source_order' => $index,
            ]);
        }
    }
    
    private function deleteAllIncomeSources(): void {
        $sql = "DELETE FROM saved_income_sources";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
    }
    
    private function loadIncomeSources(): array {
        $sql = "SELECT * FROM saved_income_sources ORDER BY source_order";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }
}
