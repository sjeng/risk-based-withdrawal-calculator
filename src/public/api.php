<?php

/**
 * API Endpoint for guardrail calculator
 * Handles AJAX requests from the frontend
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/GuardrailCalculator.php';
require_once __DIR__ . '/../classes/CalculationRepository.php';
require_once __DIR__ . '/../utils/helpers.php';
require_once __DIR__ . '/../utils/validation.php';

try {
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'calculate':
            handleCalculate();
            break;
            
        case 'history':
            handleHistory();
            break;
            
        case 'get':
            handleGet();
            break;
            
        case 'delete':
            handleDelete();
            break;
            
        case 'stats':
            handleStats();
            break;
            
        case 'save_inputs':
            handleSaveInputs();
            break;
            
        case 'load_inputs':
            handleLoadInputs();
            break;
            
        default:
            errorResponse('Invalid action', 400);
    }
    
} catch (Exception $e) {
    logError('API Error: ' . $e->getMessage(), [
        'trace' => $e->getTraceAsString()
    ]);
    errorResponse('An error occurred: ' . $e->getMessage(), 500);
}

/**
 * Handle calculate request
 */
function handleCalculate(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    // Get JSON input
    $input = getJsonInput();
    if ($input === null) {
        errorResponse('Invalid JSON input', 400);
    }
    
    // Validate input
    $errors = validateCalculationInput($input);
    if (!empty($errors)) {
        errorResponse('Validation failed', 400, $errors);
    }
    
    // Sanitize input
    $params = sanitizeCalculationInput($input);
    
    // Set defaults for optional parameters
    $config = require __DIR__ . '/../config/config.php';
    $params['annual_fee_percentage'] = $params['annual_fee_percentage'] ?? $config['defaults']['annual_fee'];
    $params['inflation_rate'] = $params['inflation_rate'] ?? $config['defaults']['inflation_rate'];
    $params['monte_carlo_iterations'] = $params['monte_carlo_iterations'] ?? $config['monte_carlo']['default_iterations'];
    $params['spending_profile_type'] = $params['spending_profile_type'] ?? 'smile';
    
    // Create calculator with guardrail settings
    $calculator = new GuardrailCalculator(
        $params['lower_guardrail'] ?? null,
        $params['upper_guardrail'] ?? null,
        $params['target_pos'] ?? null,
        $params['spending_adjustment_percentage'] ?? null
    );
    
    // Run calculation
    $startTime = microtime(true);
    $results = $calculator->calculate($params);
    $executionTime = round((microtime(true) - $startTime) * 1000);
    
    // Generate interpretation
    $interpretation = $calculator->generateInterpretation($results);
    
    // Save to database
    try {
        $repository = new CalculationRepository();
        $calculationId = $repository->saveCalculation($params, $results);
        $results['calculation_id'] = $calculationId;
    } catch (Exception $e) {
        logError('Failed to save calculation: ' . $e->getMessage());
        // Continue anyway, just log the error
    }
    
    // Add interpretation to results
    $results['interpretation'] = $interpretation;
    $results['execution_time_ms'] = $executionTime;
    
    successResponse($results);
}

/**
 * Handle history request
 */
function handleHistory(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Method not allowed', 405);
    }
    
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $limit = max(1, min($limit, 100)); // Clamp between 1 and 100
    
    $repository = new CalculationRepository();
    $calculations = $repository->getRecentCalculations($limit);
    
    successResponse([
        'calculations' => $calculations,
        'count' => count($calculations),
    ]);
}

/**
 * Handle get single calculation request
 */
function handleGet(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Method not allowed', 405);
    }
    
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        errorResponse('Invalid calculation ID', 400);
    }
    
    $repository = new CalculationRepository();
    $calculation = $repository->getCalculationById($id);
    
    if ($calculation === null) {
        errorResponse('Calculation not found', 404);
    }
    
    successResponse(['calculation' => $calculation]);
}

/**
 * Handle delete request
 */
function handleDelete(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = getJsonInput();
    if ($input === null || !isset($input['id'])) {
        errorResponse('Invalid input', 400);
    }
    
    $id = (int)$input['id'];
    if ($id <= 0) {
        errorResponse('Invalid calculation ID', 400);
    }
    
    $repository = new CalculationRepository();
    $success = $repository->deleteCalculation($id);
    
    if ($success) {
        successResponse(['message' => 'Calculation deleted successfully']);
    } else {
        errorResponse('Failed to delete calculation', 500);
    }
}

/**
 * Handle statistics request
 */
function handleStats(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Method not allowed', 405);
    }
    
    $repository = new CalculationRepository();
    $stats = $repository->getStatistics();
    
    successResponse(['statistics' => $stats]);
}

/**
 * Handle save inputs request (auto-save)
 */
function handleSaveInputs(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = getJsonInput();
    if ($input === null) {
        errorResponse('Invalid JSON input', 400);
    }
    
    require_once __DIR__ . '/../classes/SavedInputRepository.php';
    $repository = new SavedInputRepository();
    
    $success = $repository->saveInputs($input);
    
    if ($success) {
        successResponse(['message' => 'Inputs saved successfully']);
    } else {
        errorResponse('Failed to save inputs', 500);
    }
}

/**
 * Handle load inputs request
 */
function handleLoadInputs(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Method not allowed', 405);
    }
    
    require_once __DIR__ . '/../classes/SavedInputRepository.php';
    $repository = new SavedInputRepository();
    
    $inputs = $repository->loadInputs();
    $hasSavedData = $inputs !== null;
    
    successResponse([
        'has_saved_data' => $hasSavedData,
        'inputs' => $inputs ?? [],
    ]);
}
