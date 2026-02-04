// Main application JavaScript

// Global state
const app = {
    charts: {},
    currentResults: null,
};

// Format currency
function formatCurrency(amount, decimals = 0) {
    return '$' + amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Format percentage
function formatPercentage(value, decimals = 2) {
    return value.toFixed(decimals) + '%';
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const form = document.getElementById('calculatorForm');
    form.insertBefore(errorDiv, form.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

// Update allocation bar display
function updateAllocationBar() {
    const stock = parseFloat(document.getElementById('stockAllocation').value) || 0;
    const bond = parseFloat(document.getElementById('bondAllocation').value) || 0;
    const cash = parseFloat(document.getElementById('cashAllocation').value) || 0;
    
    const total = stock + bond + cash;
    document.getElementById('allocationTotal').textContent = total.toFixed(1);
    
    const bar = document.getElementById('allocationBar');
    bar.innerHTML = '';
    
    if (total > 0) {
        if (stock > 0) {
            const stockDiv = document.createElement('div');
            stockDiv.style.width = (stock / total * 100) + '%';
            stockDiv.style.backgroundColor = '#3b82f6';
            stockDiv.title = `Stocks: ${stock}%`;
            bar.appendChild(stockDiv);
        }
        
        if (bond > 0) {
            const bondDiv = document.createElement('div');
            bondDiv.style.width = (bond / total * 100) + '%';
            bondDiv.style.backgroundColor = '#10b981';
            bondDiv.title = `Bonds: ${bond}%`;
            bar.appendChild(bondDiv);
        }
        
        if (cash > 0) {
            const cashDiv = document.createElement('div');
            cashDiv.style.width = (cash / total * 100) + '%';
            cashDiv.style.backgroundColor = '#f59e0b';
            cashDiv.title = `Cash: ${cash}%`;
            bar.appendChild(cashDiv);
        }
    }
    
    // Color code the total
    const totalSpan = document.getElementById('allocationTotal');
    if (Math.abs(total - 100) < 0.01) {
        totalSpan.style.color = '#16a34a';
    } else {
        totalSpan.style.color = '#dc2626';
    }
}

// Income source counter
let incomeSourceCounter = 0;

// Add income source
function addIncomeSource(savedData = null) {
    incomeSourceCounter++;
    const container = document.getElementById('incomeSourcesContainer');
    
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'income-source';
    sourceDiv.dataset.sourceId = incomeSourceCounter;
    
        const name = savedData?.source_name || '';
    const recipient = savedData?.recipient || 'household';
    const amount = savedData?.annual_amount || '';
    const startAge = savedData?.start_age || '';
    const endAge = savedData?.end_age || '';
    // Convert SQLite integer (0/1) or boolean to proper boolean, defaulting to true
    const inflationAdjusted = savedData?.is_inflation_adjusted == null ? true : Boolean(savedData.is_inflation_adjusted);
    
    sourceDiv.innerHTML = `
        <div class="income-source-header">
            <strong>Income Source #${incomeSourceCounter}</strong>
            <button type="button" class="remove-income" onclick="removeIncomeSource(${incomeSourceCounter})">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Source Name</label>
                <input type="text" name="income_sources[${incomeSourceCounter}][name]" placeholder="e.g., Social Security" value="${name}" required>
            </div>
            <div class="form-group">
                <label>Recipient</label>
                <select name="income_sources[${incomeSourceCounter}][recipient]">
                    <option value="household" ${recipient === 'household' ? 'selected' : ''}>Household</option>
                    <option value="spouse1" ${recipient === 'spouse1' ? 'selected' : ''}>Spouse 1</option>
                    <option value="spouse2" ${recipient === 'spouse2' ? 'selected' : ''}>Spouse 2</option>
                </select>
            </div>
            <div class="form-group">
                <label>Annual Amount</label>
                <input type="number" name="income_sources[${incomeSourceCounter}][annual_amount]" min="0" step="1" placeholder="30000" value="${amount}" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Start Age (of recipient)</label>
                <input type="number" name="income_sources[${incomeSourceCounter}][start_age]" min="0" max="120" placeholder="70" value="${startAge}" required>
                <small>Age when recipient starts receiving</small>
            </div>
            <div class="form-group">
                <label>End Age (leave blank for indefinite)</label>
                <input type="number" name="income_sources[${incomeSourceCounter}][end_age]" min="0" max="120" placeholder="" value="${endAge}">
            </div>
            <div class="form-group">
                <label>Inflation Adjusted?</label>
                <select name="income_sources[${incomeSourceCounter}][inflation_adjusted]">
                    <option value="true" ${inflationAdjusted ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!inflationAdjusted ? 'selected' : ''}>No</option>
                </select>
            </div>
        </div>
    `;
    
    container.appendChild(sourceDiv);
}

// Remove income source
function removeIncomeSource(id) {
    const source = document.querySelector(`[data-source-id="${id}"]`);
    if (source) {
        source.remove();
    }
}

// Display results
function displayResults(results) {
    app.currentResults = results;
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Probability of Success
    document.getElementById('posValue').textContent = formatPercentage(results.probability_of_success, 1);
    
    // Guardrail Status
    const statusBadge = document.getElementById('statusBadge');
    const statusMap = {
        'above_upper': { text: 'Above Upper Guardrail (Opportunity)', class: 'status-above' },
        'within_range': { text: 'Within Safe Zone', class: 'status-within' },
        'below_lower': { text: 'Below Lower Guardrail (Risk)', class: 'status-below' }
    };
    
    const status = statusMap[results.guardrail_status] || { text: 'Unknown', class: '' };
    statusBadge.textContent = status.text;
    statusBadge.className = 'status-badge ' + status.class;
    
    // Spending values
    document.getElementById('desiredSpendingResult').textContent = formatCurrency(results.desired_spending);
    document.getElementById('recommendedSpendingResult').textContent = formatCurrency(results.recommended_spending);
    
    // Adjustment needed
    const adjustmentMap = {
        'increase': '↑ Increase',
        'maintain': '→ Maintain',
        'decrease': '↓ Decrease'
    };
    const adjustmentText = adjustmentMap[results.spending_adjustment_needed] || '--';
    const changeAmount = results.spending_change_amount;
    const changeText = changeAmount !== 0 ? ` (${changeAmount > 0 ? '+' : ''}${formatCurrency(changeAmount)})` : '';
    document.getElementById('adjustmentResult').textContent = adjustmentText + changeText;
    
    // Withdrawal rate
    document.getElementById('withdrawalRateResult').textContent = formatPercentage(results.current_withdrawal_rate);
    
    // Interpretation
    document.getElementById('interpretationText').textContent = results.interpretation;
    
    // Statistics
    const mc = results.monte_carlo;
    document.getElementById('statIterations').textContent = mc.iterations.toLocaleString();
    document.getElementById('statSuccessful').textContent = mc.successful.toLocaleString();
    document.getElementById('statFailed').textContent = mc.failed.toLocaleString();
    document.getElementById('statMedian').textContent = formatCurrency(mc.percentiles.p50);
    document.getElementById('statP10').textContent = formatCurrency(mc.percentiles.p10);
    document.getElementById('statP90').textContent = formatCurrency(mc.percentiles.p90);
    document.getElementById('statExpectedReturn').textContent = formatPercentage(results.portfolio_metrics.expected_return);
    document.getElementById('statVolatility').textContent = formatPercentage(results.portfolio_metrics.portfolio_volatility);
    document.getElementById('statDuration').textContent = mc.duration_ms + ' ms (MC simulation)';
    
    // Create charts
    createProjectionChart(results);
    createGuardrailChart(results);
    
    // Scroll to results with a small top offset so PoS stays visible
    const resultsSection = document.getElementById('resultsSection');
    const offset = 170;
    const top = resultsSection.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    // Allocation listeners
    ['stockAllocation', 'bondAllocation', 'cashAllocation'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateAllocationBar);
    });
    
    // Initial allocation bar update
    updateAllocationBar();
    
    // Add income source button
    document.getElementById('addIncomeSource').addEventListener('click', () => addIncomeSource());
    
    // JSON Export button
    document.getElementById('exportJsonBtn').addEventListener('click', exportInputsAsJson);
    
    // Add default income source if none exist (will be handled by loadFromLocalStorage in calculator-form.js usually, 
    // but good to have a fallback if empty)
    if (document.querySelectorAll('.income-source').length === 0) {
        // We wait a tick to let calculator-form.js loadFromLocalStorage run first?
        // Actually calculator-form.js runs its DOMContentLoaded listener too.
        // It's safer to let calculator-form.js handle the initial population.
        // But if local storage is empty, we want a default one.
    }
});

// Make functions available globally
window.removeIncomeSource = removeIncomeSource;
window.addIncomeSource = addIncomeSource;
window.app = app;

// Export inputs as JSON
function exportInputsAsJson() {
    try {
        const formData = collectFormData();
        
        // Create a user-friendly JSON structure
        const exportData = {
            personal_info: {
                spouse1_age: formData.spouse1_age,
                spouse2_age: formData.spouse2_age,
                retirement_age: formData.retirement_age,
                planning_horizon_years: formData.planning_horizon_years
            },
            portfolio: {
                initial_portfolio_value: formData.initial_portfolio_value,
                current_portfolio_value: formData.current_portfolio_value,
                desired_spending: formData.desired_spending
            },
            asset_allocation: {
                stocks: formData.stock_allocation + '%',
                bonds: formData.bond_allocation + '%',
                cash: formData.cash_allocation + '%'
            },
            assumptions: {
                annual_fee_percentage: (formData.annual_fee_percentage * 100).toFixed(2) + '%',
                inflation_rate: (formData.inflation_rate * 100).toFixed(1) + '%',
                spending_profile_type: formData.spending_profile_type
            },
            guardrails: {
                lower_guardrail: formData.lower_guardrail + '% PoS',
                upper_guardrail: formData.upper_guardrail + '% PoS',
                spending_adjustment_percentage: formData.spending_adjustment_percentage + '%'
            },
            income_sources: formData.income_sources.map(source => ({
                name: source.name,
                recipient: source.recipient,
                annual_amount: source.annual_amount,
                start_age: source.start_age,
                end_age: source.end_age || 'indefinite',
                inflation_adjusted: source.inflation_adjusted
            })),
            monte_carlo_iterations: formData.monte_carlo_iterations
        };
        
        // Convert to formatted JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonString).then(() => {
                showExportSuccess('JSON copied to clipboard!');
            }).catch(err => {
                console.warn('Clipboard write failed, falling back to modal', err);
                showJsonModal(jsonString);
            });
        } else {
            // Fallback for non-secure contexts or browsers without clipboard API
            console.warn('Clipboard API unavailable, falling back to modal');
            showJsonModal(jsonString);
        }
        
    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export JSON: ' + error.message);
    }
}

function showExportSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #16a34a; color: white; padding: 15px 25px; border-radius: 8px; font-size: 1rem; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease-out;';
    notification.textContent = '✓ ' + message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showJsonModal(jsonString) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: white; border-radius: 12px; padding: 30px; max-width: 800px; width: 100%; max-height: 80vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';
    
    const title = document.createElement('h3');
    title.textContent = 'Exported JSON';
    title.style.marginBottom = '15px';
    
    const description = document.createElement('p');
    description.textContent = 'Copy the JSON below to paste into your AI chat:';
    description.style.marginBottom = '15px';
    description.style.color = '#4b5563';
    
    const textarea = document.createElement('textarea');
    textarea.value = jsonString;
    textarea.style.cssText = 'width: 100%; height: 400px; font-family: monospace; font-size: 0.9rem; padding: 15px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical;';
    textarea.readOnly = true;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;';
    
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy to Clipboard';
    copyButton.className = 'btn btn-primary';
    copyButton.style.width = 'auto';
    copyButton.onclick = () => {
        textarea.select();
        document.execCommand('copy');
        copyButton.textContent = '✓ Copied!';
        setTimeout(() => copyButton.textContent = 'Copy to Clipboard', 2000);
    };
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'btn btn-secondary';
    closeButton.style.width = 'auto';
    closeButton.onclick = () => modal.remove();
    
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);
    
    modalContent.appendChild(title);
    modalContent.appendChild(description);
    modalContent.appendChild(textarea);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    
    // Close on overlay click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
    
    // Select all text for easy copying
    textarea.select();
}
