<?php

require_once __DIR__ . '/Database.php';

/**
 * Repository for calculation persistence and retrieval
 */
class CalculationRepository {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Save calculation to database
     * 
     * @param array $params Input parameters
     * @param array $results Calculation results
     * @param int|null $userId Optional user ID
     * @return int Calculation ID
     */
    public function saveCalculation(array $params, array $results, ?int $userId = null): int {
        try {
            Database::beginTransaction();
            
            // Insert main calculation record
            $sql = "INSERT INTO calculations (
                user_id,
                current_age,
                spouse1_age,
                spouse2_age,
                retirement_age,
                planning_horizon_years,
                initial_portfolio_value,
                current_portfolio_value,
                current_annual_spending,
                stock_allocation,
                bond_allocation,
                cash_allocation,
                annual_fee_percentage,
                assumed_inflation_rate,
                lower_guardrail_pos,
                upper_guardrail_pos,
                target_pos,
                spending_adjustment_percentage,
                spending_profile_type,
                probability_of_success,
                recommended_annual_spending,
                spending_adjustment_needed,
                guardrail_status,
                current_withdrawal_rate,
                monte_carlo_iterations,
                successful_iterations,
                failed_iterations,
                median_final_portfolio,
                percentile_10_final,
                percentile_25_final,
                percentile_75_final,
                percentile_90_final,
                calculation_duration_ms
            ) VALUES (
                :user_id,
                :current_age,
                :spouse1_age,
                :spouse2_age,
                :retirement_age,
                :planning_horizon_years,
                :initial_portfolio_value,
                :current_portfolio_value,
                :current_annual_spending,
                :stock_allocation,
                :bond_allocation,
                :cash_allocation,
                :annual_fee_percentage,
                :assumed_inflation_rate,
                :lower_guardrail_pos,
                :upper_guardrail_pos,
                :target_pos,
                :spending_adjustment_percentage,
                :spending_profile_type,
                :probability_of_success,
                :recommended_annual_spending,
                :spending_adjustment_needed,
                :guardrail_status,
                :current_withdrawal_rate,
                :monte_carlo_iterations,
                :successful_iterations,
                :failed_iterations,
                :median_final_portfolio,
                :percentile_10_final,
                :percentile_25_final,
                :percentile_75_final,
                :percentile_90_final,
                :calculation_duration_ms
            )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':user_id' => $userId,
                ':current_age' => $params['spouse1_age'] ?? $params['current_age'],
                ':spouse1_age' => $params['spouse1_age'] ?? $params['current_age'],
                ':spouse2_age' => $params['spouse2_age'] ?? null,
                ':retirement_age' => $params['retirement_age'],
                ':planning_horizon_years' => $params['planning_horizon_years'],
                ':initial_portfolio_value' => $params['initial_portfolio_value'],
                ':current_portfolio_value' => $params['current_portfolio_value'],
                ':current_annual_spending' => $params['current_spending'],
                ':stock_allocation' => $params['stock_allocation'],
                ':bond_allocation' => $params['bond_allocation'],
                ':cash_allocation' => $params['cash_allocation'],
                ':annual_fee_percentage' => $params['annual_fee_percentage'],
                ':assumed_inflation_rate' => $params['inflation_rate'],
                ':lower_guardrail_pos' => $results['guardrail_thresholds']['lower'],
                ':upper_guardrail_pos' => $results['guardrail_thresholds']['upper'],
                ':target_pos' => $results['guardrail_thresholds']['target'],
                ':spending_adjustment_percentage' => $params['spending_adjustment_percentage'] ?? 10.0,
                ':spending_profile_type' => $params['spending_profile_type'] ?? 'smile',
                ':probability_of_success' => $results['probability_of_success'],
                ':recommended_annual_spending' => $results['recommended_spending'],
                ':spending_adjustment_needed' => $results['spending_adjustment_needed'],
                ':guardrail_status' => $results['guardrail_status'],
                ':current_withdrawal_rate' => $results['current_withdrawal_rate'],
                ':monte_carlo_iterations' => $results['monte_carlo']['iterations'],
                ':successful_iterations' => $results['monte_carlo']['successful'],
                ':failed_iterations' => $results['monte_carlo']['failed'],
                ':median_final_portfolio' => $results['monte_carlo']['percentiles']['p50'],
                ':percentile_10_final' => $results['monte_carlo']['percentiles']['p10'],
                ':percentile_25_final' => $results['monte_carlo']['percentiles']['p25'],
                ':percentile_75_final' => $results['monte_carlo']['percentiles']['p75'],
                ':percentile_90_final' => $results['monte_carlo']['percentiles']['p90'],
                ':calculation_duration_ms' => $results['calculation_duration_ms'],
            ]);
            
            $calculationId = (int) Database::lastInsertId();
            
            // Save income sources
            if (isset($params['income_sources']) && is_array($params['income_sources'])) {
                $this->saveIncomeSources($calculationId, $params['income_sources']);
            }
            
            // Save spending adjustments (if custom profile)
            if (isset($params['custom_spending_multipliers']) && is_array($params['custom_spending_multipliers'])) {
                $this->saveSpendingAdjustments($calculationId, $params['custom_spending_multipliers']);
            }
            
            // Save yearly percentiles for charting
            if (isset($results['monte_carlo']['yearly_percentiles'])) {
                $this->saveYearlyPercentiles($calculationId, $results['monte_carlo']['yearly_percentiles']);
            }
            
            Database::commit();
            
            return $calculationId;
            
        } catch (Exception $e) {
            Database::rollback();
            error_log("Failed to save calculation: " . $e->getMessage());
            throw new RuntimeException("Failed to save calculation to database");
        }
    }
    
    /**
     * Save income sources for a calculation
     */
    private function saveIncomeSources(int $calculationId, array $incomeSources): void {
        $sql = "INSERT INTO income_sources (
            calculation_id,
            source_name,
            recipient,
            annual_amount,
            start_age,
            end_age,
            is_inflation_adjusted,
            source_order
        ) VALUES (
            :calculation_id,
            :source_name,
            :recipient,
            :annual_amount,
            :start_age,
            :end_age,
            :is_inflation_adjusted,
            :source_order
        )";
        
        $stmt = $this->db->prepare($sql);
        
        foreach ($incomeSources as $index => $source) {
            $stmt->execute([
                ':calculation_id' => $calculationId,
                ':source_name' => $source['name'],
                ':recipient' => $source['recipient'] ?? 'household',
                ':annual_amount' => $source['annual_amount'],
                ':start_age' => $source['start_age'],
                ':end_age' => $source['end_age'] ?? null,
                ':is_inflation_adjusted' => $source['inflation_adjusted'] ?? true,
                ':source_order' => $index,
            ]);
        }
    }
    
    /**
     * Save spending adjustments (custom profile)
     */
    private function saveSpendingAdjustments(int $calculationId, array $multipliers): void {
        $sql = "INSERT INTO spending_adjustments (
            calculation_id,
            age,
            spending_multiplier
        ) VALUES (
            :calculation_id,
            :age,
            :spending_multiplier
        )";
        
        $stmt = $this->db->prepare($sql);
        
        foreach ($multipliers as $age => $multiplier) {
            $stmt->execute([
                ':calculation_id' => $calculationId,
                ':age' => $age,
                ':spending_multiplier' => $multiplier,
            ]);
        }
    }
    
    /**
     * Save yearly percentiles for charting
     */
    private function saveYearlyPercentiles(int $calculationId, array $yearlyPercentiles): void {
        $sql = "INSERT INTO monte_carlo_percentiles (
            calculation_id,
            year_number,
            age,
            percentile_10,
            percentile_25,
            percentile_50,
            percentile_75,
            percentile_90
        ) VALUES (
            :calculation_id,
            :year_number,
            :age,
            :percentile_10,
            :percentile_25,
            :percentile_50,
            :percentile_75,
            :percentile_90
        )";
        
        $stmt = $this->db->prepare($sql);
        
        foreach ($yearlyPercentiles as $yearData) {
            $stmt->execute([
                ':calculation_id' => $calculationId,
                ':year_number' => $yearData['year'],
                ':age' => $yearData['age'],
                ':percentile_10' => $yearData['p10'],
                ':percentile_25' => $yearData['p25'],
                ':percentile_50' => $yearData['p50'],
                ':percentile_75' => $yearData['p75'],
                ':percentile_90' => $yearData['p90'],
            ]);
        }
    }
    
    /**
     * Get calculation by ID
     */
    public function getCalculationById(int $id): ?array {
        $sql = "SELECT * FROM calculations WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        
        $calculation = $stmt->fetch();
        
        if (!$calculation) {
            return null;
        }
        
        // Load related data
        $calculation['income_sources'] = $this->getIncomeSources($id);
        $calculation['spending_adjustments'] = $this->getSpendingAdjustments($id);
        $calculation['yearly_percentiles'] = $this->getYearlyPercentiles($id);
        
        return $calculation;
    }
    
    /**
     * Get recent calculations
     */
    public function getRecentCalculations(int $limit = 20, ?int $userId = null): array {
        $sql = "SELECT * FROM calculations";
        
        if ($userId !== null) {
            $sql .= " WHERE user_id = :user_id";
        }
        
        $sql .= " ORDER BY calculation_date DESC LIMIT :limit";
        
        $stmt = $this->db->prepare($sql);
        
        if ($userId !== null) {
            $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
        }
        
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }
    
    /**
     * Get income sources for a calculation
     */
    private function getIncomeSources(int $calculationId): array {
        $sql = "SELECT * FROM income_sources WHERE calculation_id = :calculation_id ORDER BY source_order";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':calculation_id' => $calculationId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Get spending adjustments for a calculation
     */
    private function getSpendingAdjustments(int $calculationId): array {
        $sql = "SELECT * FROM spending_adjustments WHERE calculation_id = :calculation_id ORDER BY age";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':calculation_id' => $calculationId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Get yearly percentiles for a calculation
     */
    private function getYearlyPercentiles(int $calculationId): array {
        $sql = "SELECT * FROM monte_carlo_percentiles WHERE calculation_id = :calculation_id ORDER BY year_number";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':calculation_id' => $calculationId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Delete calculation
     */
    public function deleteCalculation(int $id): bool {
        $sql = "DELETE FROM calculations WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([':id' => $id]);
    }
    
    /**
     * Get calculation statistics
     */
    public function getStatistics(?int $userId = null): array {
        $where = $userId !== null ? "WHERE user_id = :user_id" : "";
        
        $sql = "SELECT 
            COUNT(*) as total_calculations,
            AVG(probability_of_success) as avg_pos,
            AVG(current_withdrawal_rate) as avg_withdrawal_rate,
            SUM(CASE WHEN guardrail_status = 'above_upper' THEN 1 ELSE 0 END) as count_above,
            SUM(CASE WHEN guardrail_status = 'within_range' THEN 1 ELSE 0 END) as count_within,
            SUM(CASE WHEN guardrail_status = 'below_lower' THEN 1 ELSE 0 END) as count_below
        FROM calculations {$where}";
        
        $stmt = $this->db->prepare($sql);
        
        if ($userId !== null) {
            $stmt->execute([':user_id' => $userId]);
        } else {
            $stmt->execute();
        }
        
        return $stmt->fetch();
    }
}
