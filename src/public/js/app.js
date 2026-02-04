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
let expenseItemCounter = 0;

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

function addExpenseItem(savedData = null) {
    expenseItemCounter++;
    const container = document.getElementById('expenseItemsContainer');

    const itemDiv = document.createElement('div');
    itemDiv.className = 'expense-item';
    itemDiv.dataset.expenseId = expenseItemCounter;

    const name = savedData?.name || '';
    const amount = savedData?.annual_amount || '';
    const startAge = savedData?.start_age || '';
    const durationYears = savedData?.duration_years || '';
    const type = savedData?.type || 'one_time';
    const inflationAdjusted = savedData?.inflation_adjusted == null ? true : Boolean(savedData.inflation_adjusted);

    itemDiv.innerHTML = `
        <div class="expense-item-header">
            <strong>Future Expense #${expenseItemCounter}</strong>
            <button type="button" class="remove-expense" onclick="removeExpenseItem(${expenseItemCounter})">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Expense Name</label>
                <input type="text" name="future_expenses[${expenseItemCounter}][name]" placeholder="e.g., Roof replacement" value="${name}" required>
            </div>
            <div class="form-group">
                <label>Annual Amount</label>
                <input type="number" name="future_expenses[${expenseItemCounter}][annual_amount]" min="0" step="1" placeholder="15000" value="${amount}" required>
            </div>
            <div class="form-group">
                <label>Start Age</label>
                <input type="number" name="future_expenses[${expenseItemCounter}][start_age]" min="0" max="120" placeholder="75" value="${startAge}" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Expense Type</label>
                <select name="future_expenses[${expenseItemCounter}][type]" class="expense-type">
                    <option value="one_time" ${type === 'one_time' ? 'selected' : ''}>One-time</option>
                    <option value="duration" ${type === 'duration' ? 'selected' : ''}>Duration (years)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Duration (years)</label>
                <input type="number" id="expenseDuration-${expenseItemCounter}" name="future_expenses[${expenseItemCounter}][duration_years]" min="1" max="60" placeholder="5" value="${durationYears}" class="expense-duration">
            </div>
            <div class="form-group">
                <label>Inflation Adjusted?</label>
                <select name="future_expenses[${expenseItemCounter}][inflation_adjusted]">
                    <option value="true" ${inflationAdjusted ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!inflationAdjusted ? 'selected' : ''}>No</option>
                </select>
            </div>
        </div>
    `;

    container.appendChild(itemDiv);

    const typeSelect = itemDiv.querySelector('.expense-type');
    const durationInput = itemDiv.querySelector('.expense-duration');
    const toggleDuration = () => {
        const isDuration = typeSelect.value === 'duration';
        durationInput.disabled = !isDuration;
        if (!isDuration) {
            durationInput.value = '';
        }
    };

    typeSelect.addEventListener('change', toggleDuration);
    toggleDuration();
}

// Remove income source
function removeIncomeSource(id) {
    const source = document.querySelector(`[data-source-id="${id}"]`);
    if (source) {
        source.remove();
    }
}

function removeExpenseItem(id) {
    const item = document.querySelector(`[data-expense-id="${id}"]`);
    if (item) {
        item.remove();
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
    document.getElementById('statYear0Income').textContent = formatCurrency(results.income_impact.year0_income);
    document.getElementById('statYear0Expenses').textContent = formatCurrency(results.income_impact.year0_expenses);
    document.getElementById('statYear0NetWithdrawal').textContent = formatCurrency(results.income_impact.year0_net_withdrawal);
    document.getElementById('statDuration').textContent = mc.duration_ms + ' ms (MC simulation)';
    
    // Create charts
    createProjectionChart(results);
    createCashflowChart(results);
    
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

    const addExpenseButton = document.getElementById('addExpenseItem');
    if (addExpenseButton) {
        addExpenseButton.addEventListener('click', () => addExpenseItem());
    }

    // Shareable link button
    document.getElementById('shareLinkBtn').addEventListener('click', copyShareableLink);
    
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
window.removeExpenseItem = removeExpenseItem;
window.addExpenseItem = addExpenseItem;
window.app = app;

// Copy shareable link
function copyShareableLink() {
    const url = window.location.href;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url)
            .then(() => showToast('Shareable link copied to clipboard.', 'success'))
            .catch(() => showToast('Unable to copy link. Please copy from the address bar.', 'error'));
        return;
    }

    const fallbackInput = document.createElement('input');
    fallbackInput.value = url;
    document.body.appendChild(fallbackInput);
    fallbackInput.select();
    fallbackInput.setSelectionRange(0, url.length);

    try {
        document.execCommand('copy');
        showToast('Shareable link copied to clipboard.', 'success');
    } catch (error) {
        showToast('Unable to copy link. Please copy from the address bar.', 'error');
    } finally {
        fallbackInput.remove();
    }
}

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const toastType = type === 'error' ? 'toast-error' : 'toast-success';
    toast.className = `toast ${toastType}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

