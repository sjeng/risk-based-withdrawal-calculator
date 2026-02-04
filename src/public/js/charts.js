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

// Create guardrail status chart
function createGuardrailChart(results) {
    updateChartDefaults();
    const ctx = document.getElementById('guardrailChart');
    
    // Destroy existing chart if it exists
    if (app.charts.guardrail) {
        app.charts.guardrail.destroy();
    }
    
    const pos = results.probability_of_success;
    const lower = results.guardrail_thresholds.lower;
    const upper = results.guardrail_thresholds.upper;
    const target = results.guardrail_thresholds.target;
    
    // Determine status color
    let statusColor;
    if (pos > upper) {
        statusColor = 'rgba(59, 130, 246, 0.8)'; // Blue (Opportunity)
    } else if (pos < lower) {
        statusColor = 'rgba(239, 68, 68, 0.8)'; // Red (Danger)
    } else {
        statusColor = 'rgba(34, 197, 94, 0.8)'; // Green (Safe Zone)
    }
    
    app.charts.guardrail = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current PoS'],
            datasets: [
                {
                    label: 'Probability of Success',
                    data: [pos],
                    backgroundColor: statusColor,
                    borderColor: statusColor.replace('0.8', '1'),
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                title: {
                    display: true,
                    text: 'Current Position vs Guardrails',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Probability of Success: ' + context.parsed.x.toFixed(1) + '%';
                        }
                    }
                },
                annotation: {
                    annotations: {
                        lowerGuardrail: {
                            type: 'line',
                            xMin: lower,
                            xMax: lower,
                            borderColor: 'rgba(239, 68, 68, 0.8)',
                            borderWidth: 3,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Lower (' + lower + '%)',
                                position: 'start',
                                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        },
                        upperGuardrail: {
                            type: 'line',
                            xMin: upper,
                            xMax: upper,
                            borderColor: 'rgba(34, 197, 94, 0.8)',
                            borderWidth: 3,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Upper (' + upper + '%)',
                                position: 'start',
                                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        },
                        targetLine: {
                            type: 'line',
                            xMin: target,
                            xMax: target,
                            borderColor: 'rgba(99, 102, 241, 0.6)',
                            borderWidth: 2,
                            borderDash: [3, 3],
                            label: {
                                display: true,
                                content: 'Target (' + target + '%)',
                                position: 'center',
                                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Probability of Success (%)'
                    }
                }
            }
        }
    });
}

// Export for use in other modules
window.createProjectionChart = createProjectionChart;
window.createGuardrailChart = createGuardrailChart;
