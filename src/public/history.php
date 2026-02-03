<?php
require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/CalculationRepository.php';
require_once __DIR__ . '/../utils/helpers.php';

$repository = new CalculationRepository();
$calculations = $repository->getRecentCalculations(50);
$stats = $repository->getStatistics();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculation History | Risk-Based Guardrail Calculator</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .history-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .history-table th,
        .history-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--gray-200);
        }
        
        .history-table th {
            background: var(--gray-100);
            font-weight: 600;
            color: var(--gray-700);
        }
        
        .history-table tr:hover {
            background: var(--gray-50);
        }
        
        .status-indicator {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .stats-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: var(--gray-50);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--gray-200);
            text-align: center;
        }
        
        .stat-card-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary-color);
        }
        
        .stat-card-label {
            color: var(--gray-600);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>📊 Calculation History</h1>
            <p class="subtitle">Review your past retirement planning calculations</p>
        </header>

        <div class="main-content">
            <!-- Statistics Summary -->
            <div class="card">
                <h2>Summary Statistics</h2>
                <div class="stats-summary">
                    <div class="stat-card">
                        <div class="stat-card-value"><?= $stats['total_calculations'] ?></div>
                        <div class="stat-card-label">Total Calculations</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value"><?= formatPercentage($stats['avg_pos'] ?? 0, 1) ?></div>
                        <div class="stat-card-label">Average PoS</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value"><?= formatPercentage($stats['avg_withdrawal_rate'] ?? 0, 1) ?></div>
                        <div class="stat-card-label">Average Withdrawal Rate</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value"><?= $stats['count_above'] ?></div>
                        <div class="stat-card-label">Above Upper Guardrail</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value"><?= $stats['count_within'] ?></div>
                        <div class="stat-card-label">Within Range</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-value"><?= $stats['count_below'] ?></div>
                        <div class="stat-card-label">Below Lower Guardrail</div>
                    </div>
                </div>
            </div>

            <!-- Calculations Table -->
            <div class="card">
                <h2>Recent Calculations</h2>
                
                <?php if (empty($calculations)): ?>
                    <p>No calculations yet. <a href="/">Run your first calculation</a>.</p>
                <?php else: ?>
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Age</th>
                                <th>Portfolio</th>
                                <th>Spending</th>
                                <th>PoS</th>
                                <th>Status</th>
                                <th>Recommendation</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($calculations as $calc): ?>
                                <tr>
                                    <td><?= date('M j, Y g:i A', strtotime($calc['calculation_date'])) ?></td>
                                    <td><?= $calc['current_age'] ?></td>
                                    <td><?= formatCurrency($calc['current_portfolio_value']) ?></td>
                                    <td><?= formatCurrency($calc['current_annual_spending']) ?></td>
                                    <td><strong><?= formatPercentage($calc['probability_of_success'], 1) ?></strong></td>
                                    <td>
                                        <?php
                                        $statusClass = 'status-indicator ';
                                        $statusClass .= $calc['guardrail_status'] === 'above_upper' ? 'status-above' : '';
                                        $statusClass .= $calc['guardrail_status'] === 'within_range' ? 'status-within' : '';
                                        $statusClass .= $calc['guardrail_status'] === 'below_lower' ? 'status-below' : '';
                                        ?>
                                        <span class="<?= $statusClass ?>">
                                            <?= getGuardrailStatusLabel($calc['guardrail_status']) ?>
                                        </span>
                                    </td>
                                    <td><?= getSpendingAdjustmentLabel($calc['spending_adjustment_needed']) ?></td>
                                    <td>
                                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" 
                                                onclick="viewCalculation(<?= $calc['id'] ?>)">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>
        </div>

        <footer class="footer">
            <p class="footer-links">
                <a href="/">← Back to Calculator</a>
            </p>
        </footer>
    </div>

    <script>
        function viewCalculation(id) {
            // For now, just show an alert. You could implement a detail view later
            alert('Viewing calculation #' + id + '\n\nDetail view coming soon!');
            // TODO: Implement detailed view modal or separate page
        }
    </script>
</body>
</html>
