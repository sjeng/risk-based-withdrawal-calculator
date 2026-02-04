// Chart creation and management using Chart.js

function updateChartDefaults() {
    const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (isLight) {
        // Light Mode Colors
        Chart.defaults.color = '#374151'; // gray-700
        Chart.defaults.borderColor = '#e5e7eb'; // gray-200
    } else {
        // Dark Mode Colors
        Chart.defaults.color = '#d1d5db'; // gray-300
        Chart.defaults.borderColor = '#4b5563'; // border-color (gray-600)
    }
}

// Create projection chart (Monte Carlo fan chart)
function createProjectionChart(results) {
    updateChartDefaults();
    const ctx = document.getElementById('projectionChart');
    
    // Destroy existing chart if it exists
    if (app.charts.projection) {
        app.charts.projection.destroy();
    }
    
    const yearlyData = results.monte_carlo.yearly_percentiles;
    
    const labels = yearlyData.map(d => `Year ${d.year}`);
    const ages = yearlyData.map(d => d.age);
    
    app.charts.projection = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '90th Percentile',
                    data: yearlyData.map(d => d.p90),
                    borderColor: 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: '+1',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: '75th Percentile',
                    data: yearlyData.map(d => d.p75),
                    borderColor: 'rgba(59, 130, 246, 0.6)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: '+1',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Median (50th)',
                    data: yearlyData.map(d => d.p50),
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: '25th Percentile',
                    data: yearlyData.map(d => d.p25),
                    borderColor: 'rgba(59, 130, 246, 0.6)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: '+1',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: '10th Percentile',
                    data: yearlyData.map(d => d.p10),
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Value Over Time (Percentiles)',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return `Year ${yearlyData[index].year} (Age ${ages[index]})`;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000000).toFixed(1) + 'M';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Portfolio Value'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                }
            }
        }
    });
}

// Create income and expenses chart
function createCashflowChart(results) {
    updateChartDefaults();
    const ctx = document.getElementById('cashflowChart');

    if (app.charts.cashflow) {
        app.charts.cashflow.destroy();
    }

    const timeline = results.cashflow_timeline || [];
    const labels = timeline.map(entry => `Year ${entry.year}`);
    const ages = timeline.map(entry => entry.age);

    app.charts.cashflow = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Income',
                    data: timeline.map(entry => entry.income),
                    borderColor: 'rgba(34, 197, 94, 0.9)',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: 'Expenses',
                    data: timeline.map(entry => entry.expenses),
                    borderColor: 'rgba(239, 68, 68, 0.9)',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: 'Net Withdrawal',
                    data: timeline.map(entry => entry.net_withdrawal),
                    borderColor: 'rgba(59, 130, 246, 0.9)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Income, Expenses, and Net Withdrawals',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return `Year ${timeline[index].year} (Age ${ages[index]})`;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000).toFixed(0) + 'k';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Annual Amount'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                }
            }
        }
    });
}

// Export for use in other modules
window.createProjectionChart = createProjectionChart;
window.createCashflowChart = createCashflowChart;
