// Main application JavaScript

// Global state
const app = {
    charts: {},
    currentResults: null,
};

// --- Collapse Toggle for Left Column ---
document.addEventListener('DOMContentLoaded', () => {
    const collapseBtn = document.getElementById('collapseBtn');
    const inputColumn = document.getElementById('inputColumn');

    if (collapseBtn && inputColumn) {
        // Restore saved state
        const savedState = localStorage.getItem('inputColumnCollapsed');
        if (savedState === 'true') {
            inputColumn.classList.add('collapsed');
        }

        collapseBtn.addEventListener('click', () => {
            inputColumn.classList.toggle('collapsed');
            const isCollapsed = inputColumn.classList.contains('collapsed');
            localStorage.setItem('inputColumnCollapsed', isCollapsed);
            // Trigger chart resize after transition completes
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 350);
        });
    }
});

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
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Annual Amount</label>
                <input type="number" name="income_sources[${incomeSourceCounter}][annual_amount]" min="0" step="1" placeholder="30000" value="${amount}" required>
            </div>
            <div class="form-group">
                <label>Inflation Adjusted?</label>
                <select name="income_sources[${incomeSourceCounter}][inflation_adjusted]">
                    <option value="true" ${inflationAdjusted ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!inflationAdjusted ? 'selected' : ''}>No</option>
                </select>
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
                <label>Inflation Adjusted?</label>
                <select name="future_expenses[${expenseItemCounter}][inflation_adjusted]">
                    <option value="true" ${inflationAdjusted ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!inflationAdjusted ? 'selected' : ''}>No</option>
                </select>
            </div>
        </div>
        <div class="form-row">
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
function displayResults(results, enhancedResults) {
    app.currentResults = results;
    app.enhancedResults = enhancedResults || null;
    
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
    
    // Enhanced MC comparison display
    displayEnhancedResults(enhancedResults);
    
    // Create charts
    createProjectionChart(results, enhancedResults);
    createCashflowChart(results);
    
    // Scroll only in single-column layout
    const resultsSection = document.getElementById('resultsSection');
    const isSingleColumn = window.matchMedia('(max-width: 1024px)').matches;
    if (isSingleColumn) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

    // Advanced section toggle
    const advancedToggle = document.getElementById('advancedToggle');
    if (advancedToggle) {
        advancedToggle.addEventListener('click', () => {
            const content = document.getElementById('advancedContent');
            const isExpanded = advancedToggle.getAttribute('aria-expanded') === 'true';
            advancedToggle.setAttribute('aria-expanded', !isExpanded);
            content.style.display = isExpanded ? 'none' : 'block';
            advancedToggle.textContent = isExpanded
                ? 'Advanced Simulation Options \u25b8'
                : 'Advanced Simulation Options \u25be';
        });
    }

    // Enhanced MC checkbox toggle
    const enhancedCheckbox = document.getElementById('enhancedMcEnabled');
    if (enhancedCheckbox) {
        enhancedCheckbox.addEventListener('change', () => {
            const optionsDiv = document.getElementById('enhancedMcOptions');
            if (optionsDiv) {
                optionsDiv.style.display = enhancedCheckbox.checked ? 'block' : 'none';
            }
            updateCalculateButtonLabel();
        });
    }

    // Autocorrelation slider value display
    const acSlider = document.getElementById('enhancedMcAutocorrelation');
    const acSliderValue = document.getElementById('autocorrelationValue');
    if (acSlider && acSliderValue) {
        acSlider.addEventListener('input', () => {
            acSliderValue.textContent = parseFloat(acSlider.value).toFixed(2);
        });
    }
    
    // Fallback handled by calculator-form.js
    if (document.querySelectorAll('.income-source').length === 0) {
        // Let calculator-form.js handle initial population
    }
});

// Make functions available globally
window.removeIncomeSource = removeIncomeSource;
window.addIncomeSource = addIncomeSource;
window.removeExpenseItem = removeExpenseItem;
window.addExpenseItem = addExpenseItem;
window.app = app;

// Update the calculate button label based on enhanced MC toggle
function updateCalculateButtonLabel() {
    const btn = document.getElementById('calculateBtn');
    const enhanced = document.getElementById('enhancedMcEnabled')?.checked;
    if (btn) {
        btn.textContent = enhanced
            ? '\ud83d\udd2c Run Simulations (2\u00d7 10,000 iterations)'
            : '\ud83d\udd2c Run Simulations (10,000 iterations)';
    }
}
window.updateCalculateButtonLabel = updateCalculateButtonLabel;

// Display enhanced MC comparison results
function displayEnhancedResults(enhancedResults) {
    const banner = document.getElementById('enhancedComparisonBanner');
    const grid = document.getElementById('enhancedResultsGrid');
    const statsSection = document.getElementById('enhancedStatsSection');

    if (!enhancedResults) {
        if (banner) banner.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (statsSection) statsSection.style.display = 'none';
        return;
    }

    const standardPos = app.currentResults.probability_of_success;
    const enhancedPos = enhancedResults.probability_of_success;
    const posDiff = standardPos - enhancedPos;

    // Comparison banner
    if (banner) {
        banner.style.display = 'block';
        const summary = document.getElementById('comparisonSummary');
        if (summary) {
            let text = `Standard MC: ${formatPercentage(standardPos, 1)} PoS | Enhanced MC (Mean-Reverting): ${formatPercentage(enhancedPos, 1)} PoS`;
            if (posDiff > 0.5) {
                text += ` — The enhanced model suggests ${posDiff.toFixed(1)} percentage points lower probability of success, indicating the standard model may be slightly over-optimistic at this spending level.`;
            } else if (posDiff < -0.5) {
                text += ` — The enhanced model suggests ${Math.abs(posDiff).toFixed(1)} percentage points higher probability of success.`;
            } else {
                text += ` — Both models are in close agreement at this spending level.`;
            }
            summary.textContent = text;
        }
    }

    // Enhanced results grid
    if (grid) {
        grid.style.display = 'grid';

        document.getElementById('enhancedPosResult').textContent = formatPercentage(enhancedPos, 1);
        document.getElementById('enhancedRecommendedResult').textContent = formatCurrency(enhancedResults.recommended_spending);

        const adjustmentMap = {
            'increase': '\u2191 Increase',
            'maintain': '\u2192 Maintain',
            'decrease': '\u2193 Decrease'
        };
        const adjText = adjustmentMap[enhancedResults.spending_adjustment_needed] || '--';
        const changeAmount = enhancedResults.spending_change_amount;
        const changeText = changeAmount !== 0 ? ` (${changeAmount > 0 ? '+' : ''}${formatCurrency(changeAmount)})` : '';
        document.getElementById('enhancedAdjustmentResult').textContent = adjText + changeText;

        const phi = enhancedResults.enhanced_mc_autocorrelation;
        document.getElementById('enhancedAutocorrelationResult').textContent = phi != null ? phi.toFixed(2) : '--';
    }

    // Enhanced statistics
    if (statsSection) {
        statsSection.style.display = 'block';
        const emc = enhancedResults.monte_carlo;
        document.getElementById('statEnhancedIterations').textContent = emc.iterations.toLocaleString();
        document.getElementById('statEnhancedSuccessful').textContent = emc.successful.toLocaleString();
        document.getElementById('statEnhancedFailed').textContent = emc.failed.toLocaleString();
        document.getElementById('statEnhancedMedian').textContent = formatCurrency(emc.percentiles.p50);
        document.getElementById('statEnhancedP10').textContent = formatCurrency(emc.percentiles.p10);
        document.getElementById('statEnhancedP90').textContent = formatCurrency(emc.percentiles.p90);
        document.getElementById('statEnhancedDuration').textContent = enhancedResults.calculation_duration_ms + ' ms';
    }
}

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

