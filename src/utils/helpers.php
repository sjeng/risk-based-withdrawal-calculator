<?php

/**
 * Helper functions for the application
 */

/**
 * Sanitize output for HTML display
 */
function h(string $string): string {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

/**
 * Format currency
 */
function formatCurrency(float $amount, int $decimals = 0): string {
    return '$' . number_format($amount, $decimals);
}

/**
 * Format percentage
 */
function formatPercentage(float $percentage, int $decimals = 2): string {
    return number_format($percentage, $decimals) . '%';
}

/**
 * JSON response helper
 */
function jsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Error response helper
 */
function errorResponse(string $message, int $statusCode = 400, array $details = []): void {
    jsonResponse([
        'success' => false,
        'error' => $message,
        'details' => $details
    ], $statusCode);
}

/**
 * Success response helper
 */
function successResponse(array $data): void {
    jsonResponse([
        'success' => true,
        'data' => $data
    ]);
}

/**
 * Log error message
 */
function logError(string $message, array $context = []): void {
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? json_encode($context) : '';
    $logMessage = "[{$timestamp}] {$message} {$contextStr}\n";
    
    $logFile = __DIR__ . '/../storage/logs/error.log';
    error_log($logMessage, 3, $logFile);
}

/**
 * Get request body as JSON
 */
function getJsonInput(): ?array {
    $json = file_get_contents('php://input');
    if (empty($json)) {
        return null;
    }
    
    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }
    
    return $data;
}

/**
 * Validate required fields in array
 */
function validateRequired(array $data, array $requiredFields): array {
    $missing = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            $missing[] = $field;
        }
    }
    
    return $missing;
}

/**
 * Convert array keys from snake_case to camelCase
 */
function snakeToCamel(array $array): array {
    $result = [];
    foreach ($array as $key => $value) {
        $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
        $result[$camelKey] = is_array($value) ? snakeToCamel($value) : $value;
    }
    return $result;
}

/**
 * Convert array keys from camelCase to snake_case
 */
function camelToSnake(array $array): array {
    $result = [];
    foreach ($array as $key => $value) {
        $snakeKey = strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $key));
        $result[$snakeKey] = is_array($value) ? camelToSnake($value) : $value;
    }
    return $result;
}

/**
 * Get guardrail status color
 */
function getGuardrailStatusColor(string $status): string {
    $colors = [
        'above_upper' => '#28a745', // Green
        'within_range' => '#ffc107', // Yellow/Amber
        'below_lower' => '#dc3545', // Red
    ];
    
    return $colors[$status] ?? '#6c757d'; // Gray default
}

/**
 * Get guardrail status label
 */
function getGuardrailStatusLabel(string $status): string {
    $labels = [
        'above_upper' => 'Above Upper Guardrail',
        'within_range' => 'Within Range',
        'below_lower' => 'Below Lower Guardrail',
    ];
    
    return $labels[$status] ?? 'Unknown';
}

/**
 * Get spending adjustment label
 */
function getSpendingAdjustmentLabel(string $adjustment): string {
    $labels = [
        'increase' => 'Consider Increasing',
        'maintain' => 'Maintain Current',
        'decrease' => 'Consider Decreasing',
    ];
    
    return $labels[$adjustment] ?? 'Unknown';
}

/**
 * Clamp value between min and max
 */
function clamp(float $value, float $min, float $max): float {
    return max($min, min($max, $value));
}

/**
 * Calculate years between ages
 */
function yearsBetween(int $age1, int $age2): int {
    return abs($age2 - $age1);
}

/**
 * Format large numbers with suffixes (K, M, B)
 */
function formatLargeNumber(float $number): string {
    if ($number >= 1000000000) {
        return '$' . number_format($number / 1000000000, 1) . 'B';
    } elseif ($number >= 1000000) {
        return '$' . number_format($number / 1000000, 1) . 'M';
    } elseif ($number >= 1000) {
        return '$' . number_format($number / 1000, 1) . 'K';
    } else {
        return formatCurrency($number, 0);
    }
}

/**
 * Get config value
 */
function config(string $key, $default = null) {
    static $config = null;
    
    if ($config === null) {
        $config = require __DIR__ . '/../config/config.php';
    }
    
    $keys = explode('.', $key);
    $value = $config;
    
    foreach ($keys as $k) {
        if (!isset($value[$k])) {
            return $default;
        }
        $value = $value[$k];
    }
    
    return $value;
}

/**
 * Check if request is AJAX
 */
function isAjax(): bool {
    return !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
           strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

/**
 * Redirect to URL
 */
function redirect(string $url): void {
    header("Location: {$url}");
    exit;
}

/**
 * Get current URL
 */
function currentUrl(): string {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
}
