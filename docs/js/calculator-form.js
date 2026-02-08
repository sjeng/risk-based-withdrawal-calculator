// Calculator form handling

// Initialize Web Worker
let calculatorWorker = null;
try {
    if (window.Worker) {
        calculatorWorker = new Worker('js/worker.js', { type: 'module' });
    } else {
        console.error("Web Workers are not supported in this browser.");
    }
} catch (e) {
    console.error("Failed to initialize Web Worker:", e);
}

// Local Storage Key
const STORAGE_KEY = 'guardrail_calculator_data';

const QUERY_PARAM_MAP = {
    spouse1_age: 's1',
    spouse2_age: 's2',
    retirement_age: 'ra',
    planning_horizon_years: 'ph',
    initial_portfolio_value: 'ip',
    current_portfolio_value: 'cp',
    desired_spending: 'ds',
    stock_allocation: 'sa',
    bond_allocation: 'ba',
    cash_allocation: 'ca',
    annual_fee_percentage: 'af',
    inflation_rate: 'ir',
    spending_profile_type: 'sp',
    lower_guardrail: 'lg',
    upper_guardrail: 'ug',
    spending_adjustment_percentage: 'adj',
    enhanced_mc_enabled: 'em',
    enhanced_mc_autocorrelation: 'ea'
};

const INCOME_PARAM_MAP = {
    name: 'n',
    recipient: 'r',
    annual_amount: 'a',
    start_age: 's',
    end_age: 'e',
    inflation_adjusted: 'i'
};

const EXPENSE_PARAM_MAP = {
    name: 'n',
    annual_amount: 'a',
    start_age: 's',
    duration_years: 'd',
    type: 't',
    inflation_adjusted: 'i'
};

const STATE_PARAM_KEY = 'state';

// Load saved data on page load
document.addEventListener('DOMContentLoaded', () => {
    const loadedFromQueryParams = loadFromQueryParams();
    if (!loadedFromQueryParams) {
        loadFromLocalStorage();
        updateQueryParamsFromForm();
    }
    
    // Auto-save on input changes
    const form = document.getElementById('calculatorForm');
    const persistFormState = debounce(() => {
        saveToLocalStorage();
        updateQueryParamsFromForm();
    }, 1000);

    form.addEventListener('input', persistFormState);
    
    // Also save when income sources change (using MutationObserver if available, or just relying on inputs)
    // Inputs inside income sources will trigger the 'input' event on the form due to bubbling.
    // However, removing an income source (click) isn't an 'input' event.
    // So we should hook into the remove button or observe the container.
    const incomeContainer = document.getElementById('incomeSourcesContainer');
    if (incomeContainer) {
        const observer = new MutationObserver(() => {
             saveToLocalStorage();
             updateQueryParamsFromForm();
        });
        observer.observe(incomeContainer, { childList: true, subtree: true });
    }

    const expenseContainer = document.getElementById('expenseItemsContainer');
    if (expenseContainer) {
        const observer = new MutationObserver(() => {
            saveToLocalStorage();
            updateQueryParamsFromForm();
        });
        observer.observe(expenseContainer, { childList: true, subtree: true });
    }
});

document.getElementById('calculatorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('calculateBtn').disabled = true;
    
    // Hide results section
    document.getElementById('resultsSection').style.display = 'none';
    
    try {
        // Collect form data
        const formData = collectFormData();
        
        // Validate
        const validation = validateFormData(formData);
        if (!validation.valid) {
            showError(validation.message);
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('calculateBtn').disabled = false;
            return;
        }

        if (calculatorWorker) {
            calculatorWorker.onmessage = function(e) {
                const response = e.data;
                
                if (response.status === 'success') {
                    displayResults(response.results, response.enhancedResults);
                } else {
                    console.error('Calculation error:', response.message);
                    showError('Error: ' + response.message);
                }
                
                // Hide loading indicator
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('calculateBtn').disabled = false;
            };
            
            calculatorWorker.onerror = function(error) {
                console.error('Worker error:', error);
                showError('Calculation failed due to a script error.');
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('calculateBtn').disabled = false;
            };

            calculatorWorker.postMessage(formData);
        } else {
            showError("Web Workers are not supported in this browser.");
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('calculateBtn').disabled = false;
        }
        
    } catch (error) {
        console.error('Calculation error:', error);
        showError('Error: ' + error.message);
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('calculateBtn').disabled = false;
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function saveToLocalStorage() {
    const formData = collectFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
}

function updateQueryParamsFromForm() {
    const form = document.getElementById('calculatorForm');
    if (!form) return;

    const state = buildStateFromForm(form);
    const params = new URLSearchParams();

    if (Object.keys(state).length > 0) {
        params.set(STATE_PARAM_KEY, encodeState(state));
    }

    const queryString = params.toString();
    const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
}

function buildStateFromForm(form) {
    const state = {};
    const elements = form.querySelectorAll('input, select, textarea');

    elements.forEach(element => {
        if (!element.name) return;

        const incomeMatch = element.name.match(/^income_sources\[(\d+)\]\[(.+)\]$/);
        if (incomeMatch) {
            const index = incomeMatch[1];
            const field = incomeMatch[2];
            const shortField = INCOME_PARAM_MAP[field] || field;
            const shortKey = `i${index}${shortField}`;

            if (shouldIncludeValue(element)) {
                state[shortKey] = element.value;
            }

            return;
        }

        const expenseMatch = element.name.match(/^future_expenses\[(\d+)\]\[(.+)\]$/);
        if (expenseMatch) {
            const index = expenseMatch[1];
            const field = expenseMatch[2];
            const shortField = EXPENSE_PARAM_MAP[field] || field;
            const shortKey = `x${index}${shortField}`;

            if (shouldIncludeValue(element)) {
                state[shortKey] = element.value;
            }

            return;
        }

        const shortKey = QUERY_PARAM_MAP[element.name] || element.name;
        if (shouldIncludeValue(element)) {
            state[shortKey] = element.value;
        }
    });

    return state;
}

function encodeState(state) {
    const json = JSON.stringify(state);
    return base64UrlEncode(json);
}

function decodeState(value) {
    try {
        const json = base64UrlDecode(value);
        return JSON.parse(json);
    } catch (error) {
        console.error('Failed to decode state param', error);
        return null;
    }
}

function base64UrlEncode(value) {
    const utf8 = encodeURIComponent(value)
        .replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return btoa(utf8)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const base64 = padded + '='.repeat(padLength);
    const utf8 = atob(base64);
    const escaped = utf8
        .split('')
        .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('');
    return decodeURIComponent(escaped);
}

function shouldIncludeValue(element) {
    if (element.type === 'checkbox') {
        return element.checked;
    }

    if (element.type === 'radio') {
        return element.checked && element.checked !== element.defaultChecked;
    }

    if (element.tagName === 'SELECT') {
        const defaultOption = Array.from(element.options).find(option => option.defaultSelected) || element.options[0];
        const defaultValue = defaultOption ? defaultOption.value : '';
        return element.value !== '' && element.value !== defaultValue;
    }

    return element.value !== '' && element.value !== element.defaultValue;
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        const form = document.getElementById('calculatorForm');

        // Populate basic fields
        for (const [key, value] of Object.entries(data)) {
            if (key === 'income_sources' || key === 'future_expenses') continue;
            
            // Handle percentages that were divided by 100 in collectFormData
            if (['annual_fee_percentage', 'inflation_rate'].includes(key)) {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) input.value = value * 100;
                continue;
            }

            // Handle enhanced MC checkbox
            if (key === 'enhanced_mc_enabled') {
                const checkbox = document.getElementById('enhancedMcEnabled');
                if (checkbox) {
                    checkbox.checked = Boolean(value);
                    const optionsDiv = document.getElementById('enhancedMcOptions');
                    if (optionsDiv) optionsDiv.style.display = value ? 'block' : 'none';
                    updateCalculateButtonLabel();
                }
                continue;
            }

            // Handle enhanced MC autocorrelation
            if (key === 'enhanced_mc_autocorrelation') {
                const slider = document.getElementById('enhancedMcAutocorrelation');
                if (slider) {
                    slider.value = value;
                    const display = document.getElementById('autocorrelationValue');
                    if (display) display.textContent = parseFloat(value).toFixed(2);
                }
                continue;
            }

            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        }
        
        // Re-populate income sources
        if (data.income_sources && Array.isArray(data.income_sources) && data.income_sources.length > 0) {
            // Clear existing (though usually empty on load)
            const container = document.getElementById('incomeSourcesContainer');
            if (container) container.innerHTML = '';
            
            // Re-create sources
            data.income_sources.forEach(source => {
                // Ensure field names match what addIncomeSource expects
                // data.income_sources comes from collectFormData, which has structure:
                // { name, recipient, annual_amount, start_age, end_age, inflation_adjusted }
                // addIncomeSource expects { source_name, recipient, annual_amount, start_age, end_age, is_inflation_adjusted }
                // or just passes it through?
                // Let's check app.js addIncomeSource again.
                // const name = savedData?.source_name || '';
                // It looks for source_name. But collectFormData provides 'name'.
                
                const mappedSource = {
                    source_name: source.name,
                    recipient: source.recipient,
                    annual_amount: source.annual_amount,
                    start_age: source.start_age,
                    end_age: source.end_age,
                    is_inflation_adjusted: source.inflation_adjusted
                };
                
                if (window.addIncomeSource) {
                    window.addIncomeSource(mappedSource);
                }
            });
        } else {
             // If no saved income sources, add default
             if (window.addIncomeSource) {
                 window.addIncomeSource();
             }
        }

        if (data.future_expenses && Array.isArray(data.future_expenses) && data.future_expenses.length > 0) {
            const container = document.getElementById('expenseItemsContainer');
            if (container) container.innerHTML = '';

            data.future_expenses.forEach(item => {
                const mappedItem = {
                    name: item.name,
                    annual_amount: item.annual_amount,
                    start_age: item.start_age,
                    duration_years: item.duration_years,
                    type: item.type,
                    inflation_adjusted: item.inflation_adjusted
                };

                if (window.addExpenseItem) {
                    window.addExpenseItem(mappedItem);
                }
            });
        }
        
        // Trigger allocation bar update
        if (typeof updateAllocationBar === 'function') {
            updateAllocationBar();
        }

    } catch (e) {
        console.error("Error loading from local storage", e);
        // Fallback: add default income source if something crashed
        if (window.addIncomeSource && document.querySelectorAll('.income-source').length === 0) {
            window.addIncomeSource();
        }
    }
}

function loadFromQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get(STATE_PARAM_KEY);
    if (!stateParam) return false;

    const form = document.getElementById('calculatorForm');
    if (!form) return false;

    const reverseQueryMap = Object.entries(QUERY_PARAM_MAP)
        .reduce((acc, [fullKey, shortKey]) => {
            acc[shortKey] = fullKey;
            return acc;
        }, {});

    const reverseIncomeMap = Object.entries(INCOME_PARAM_MAP)
        .reduce((acc, [fullKey, shortKey]) => {
            acc[shortKey] = fullKey;
            return acc;
        }, {});

    const reverseExpenseMap = Object.entries(EXPENSE_PARAM_MAP)
        .reduce((acc, [fullKey, shortKey]) => {
            acc[shortKey] = fullKey;
            return acc;
        }, {});

    const decodedState = decodeState(stateParam);
    if (!decodedState || typeof decodedState !== 'object') {
        return false;
    }

    const resolvedEntries = [];
    Object.entries(decodedState).forEach(([key, value]) => {
        const incomeShortMatch = key.match(/^i(\d+)([a-z]+)$/i);
        if (incomeShortMatch) {
            const index = incomeShortMatch[1];
            const shortField = incomeShortMatch[2];
            const field = reverseIncomeMap[shortField];
            if (!field) {
                return;
            }
            resolvedEntries.push([`income_sources[${index}][${field}]`, value]);
            return;
        }

        const expenseShortMatch = key.match(/^x(\d+)([a-z]+)$/i);
        if (expenseShortMatch) {
            const index = expenseShortMatch[1];
            const shortField = expenseShortMatch[2];
            const field = reverseExpenseMap[shortField];
            if (!field) {
                return;
            }
            resolvedEntries.push([`future_expenses[${index}][${field}]`, value]);
            return;
        }

        const fullKey = reverseQueryMap[key];
        if (fullKey) {
            resolvedEntries.push([fullKey, value]);
        }
    });

    const incomeIndexes = new Set();
    const expenseIndexes = new Set();
    for (const [key] of resolvedEntries) {
        const match = key.match(/^income_sources\[(\d+)\]\[.+\]$/);
        if (match) {
            incomeIndexes.add(parseInt(match[1], 10));
        }

        const expenseMatch = key.match(/^future_expenses\[(\d+)\]\[.+\]$/);
        if (expenseMatch) {
            expenseIndexes.add(parseInt(expenseMatch[1], 10));
        }
    }

    if (incomeIndexes.size > 0) {
        const container = document.getElementById('incomeSourcesContainer');
        if (container) container.innerHTML = '';

        const maxIndex = Math.max(...incomeIndexes);
        for (let index = 0; index < maxIndex; index += 1) {
            if (window.addIncomeSource) {
                window.addIncomeSource();
            }
        }
    } else if (window.addIncomeSource && document.querySelectorAll('.income-source').length === 0) {
        window.addIncomeSource();
    }

    if (expenseIndexes.size > 0) {
        const container = document.getElementById('expenseItemsContainer');
        if (container) container.innerHTML = '';

        const maxIndex = Math.max(...expenseIndexes);
        for (let index = 0; index < maxIndex; index += 1) {
            if (window.addExpenseItem) {
                window.addExpenseItem();
            }
        }
    }

    for (const [key, value] of resolvedEntries) {
        // Handle checkbox for enhanced MC
        if (key === 'enhanced_mc_enabled') {
            const checkbox = document.getElementById('enhancedMcEnabled');
            if (checkbox) {
                checkbox.checked = value === 'true' || value === true;
                const optionsDiv = document.getElementById('enhancedMcOptions');
                if (optionsDiv) optionsDiv.style.display = checkbox.checked ? 'block' : 'none';
                // Expand the advanced section if enhanced MC is enabled
                if (checkbox.checked) {
                    const advContent = document.getElementById('advancedContent');
                    const advToggle = document.getElementById('advancedToggle');
                    if (advContent) advContent.style.display = 'block';
                    if (advToggle) {
                        advToggle.setAttribute('aria-expanded', 'true');
                        advToggle.textContent = 'Advanced Simulation Options \u25be';
                    }
                }
                updateCalculateButtonLabel();
            }
            continue;
        }

        const input = form.querySelector(`[name="${CSS.escape(key)}"]`);
        if (input) {
            input.value = value;
            // Update autocorrelation display span if this is the slider
            if (key === 'enhanced_mc_autocorrelation') {
                const display = document.getElementById('autocorrelationValue');
                if (display) display.textContent = parseFloat(value).toFixed(2);
            }
        }
    }

    document.querySelectorAll('.expense-item').forEach(item => {
        const typeSelect = item.querySelector('.expense-type');
        const durationInput = item.querySelector('.expense-duration');
        if (!typeSelect || !durationInput) return;
        const isDuration = typeSelect.value === 'duration';
        durationInput.disabled = !isDuration;
        if (!isDuration) {
            durationInput.value = '';
        }
    });

    if (typeof updateAllocationBar === 'function') {
        updateAllocationBar();
    }

    return true;
}

// Collect form data
function collectFormData() {
    const form = document.getElementById('calculatorForm');
    const formData = new FormData(form);
    
    const data = {
        spouse1_age: parseInt(formData.get('spouse1_age')) || null,
        spouse2_age: parseInt(formData.get('spouse2_age')) || null,
        retirement_age: parseInt(formData.get('retirement_age')),
        planning_horizon_years: parseInt(formData.get('planning_horizon_years')),
        current_portfolio_value: parseFloat(formData.get('current_portfolio_value')),
        desired_spending: parseFloat(formData.get('desired_spending')),
        stock_allocation: parseFloat(formData.get('stock_allocation')),
        bond_allocation: parseFloat(formData.get('bond_allocation')),
        cash_allocation: parseFloat(formData.get('cash_allocation')),
        annual_fee_percentage: parseFloat(formData.get('annual_fee_percentage')) / 100, // Convert to decimal
        inflation_rate: parseFloat(formData.get('inflation_rate')) / 100, // Convert to decimal
        spending_profile_type: formData.get('spending_profile_type'),
        lower_guardrail: parseFloat(formData.get('lower_guardrail')),
        upper_guardrail: parseFloat(formData.get('upper_guardrail')),
        spending_adjustment_percentage: parseFloat(formData.get('spending_adjustment_percentage')),
        monte_carlo_iterations: 10000,
        enhanced_mc_enabled: document.getElementById('enhancedMcEnabled')?.checked || false,
        enhanced_mc_autocorrelation: parseFloat(document.getElementById('enhancedMcAutocorrelation')?.value) || -0.10,
    };
    
    // Collect income sources
    data.income_sources = [];
    const incomeSources = document.querySelectorAll('.income-source');
    incomeSources.forEach(source => {
        const sourceId = source.dataset.sourceId;
        const name = formData.get(`income_sources[${sourceId}][name]`);
        
        if (name) {
            const incomeSource = {
                name: name,
                recipient: formData.get(`income_sources[${sourceId}][recipient]`) || 'household',
                annual_amount: parseFloat(formData.get(`income_sources[${sourceId}][annual_amount]`)) || 0,
                start_age: parseInt(formData.get(`income_sources[${sourceId}][start_age]`)) || 0,
                end_age: formData.get(`income_sources[${sourceId}][end_age]`) ? 
                    parseInt(formData.get(`income_sources[${sourceId}][end_age]`)) : null,
                inflation_adjusted: formData.get(`income_sources[${sourceId}][inflation_adjusted]`) === 'true'
            };
            
            data.income_sources.push(incomeSource);
        }
    });

    data.future_expenses = [];
    const expenseItems = document.querySelectorAll('.expense-item');
    expenseItems.forEach(item => {
        const itemId = item.dataset.expenseId;
        const name = formData.get(`future_expenses[${itemId}][name]`);

        if (name) {
            const type = formData.get(`future_expenses[${itemId}][type]`) || 'one_time';
            const startAge = parseInt(formData.get(`future_expenses[${itemId}][start_age]`)) || 0;
            const durationYearsValue = formData.get(`future_expenses[${itemId}][duration_years]`);
            const durationYears = durationYearsValue ? parseInt(durationYearsValue) : null;
            const endAge = type === 'duration' && durationYears
                ? startAge + durationYears - 1
                : null;

            const expenseItem = {
                item_id: itemId,
                name: name,
                annual_amount: parseFloat(formData.get(`future_expenses[${itemId}][annual_amount]`)) || 0,
                start_age: startAge,
                duration_years: durationYears,
                end_age: endAge,
                type: type,
                inflation_adjusted: formData.get(`future_expenses[${itemId}][inflation_adjusted]`) === 'true',
                one_time: type === 'one_time'
            };

            data.future_expenses.push(expenseItem);
        }
    });
    
    return data;
}

// Validate form data
function validateFormData(data) {
    clearFieldErrors();
    let firstInvalidFieldId = null;

    // Check allocation totals 100%
    const totalAllocation = data.stock_allocation + data.bond_allocation + data.cash_allocation;
    if (Math.abs(totalAllocation - 100) > 0.01) {
        ['stockAllocation', 'bondAllocation', 'cashAllocation'].forEach((fieldId) => {
            showFieldError(fieldId, 'Allocations must total 100%');
            if (!firstInvalidFieldId) {
                firstInvalidFieldId = fieldId;
            }
        });
        scrollToField(firstInvalidFieldId);
        return {
            valid: false,
            message: 'Asset allocations must total 100%. Current total: ' + totalAllocation.toFixed(1) + '%'
        };
    }
    
    // Check spouse1 age >= age at retirement
    if (data.spouse1_age < data.retirement_age) {
        showFieldError('spouse1Age', 'Must be greater than or equal to retirement age');
        showFieldError('retirementAge', 'Must be less than or equal to current age');
        if (!firstInvalidFieldId) {
            firstInvalidFieldId = 'spouse1Age';
        }
        scrollToField(firstInvalidFieldId);
        return {
            valid: false,
            message: 'Current age must be greater than or equal to age at retirement'
        };
    }
    
    // Check positive values
    if (data.current_portfolio_value <= 0) {
        showFieldError('currentPortfolio', 'Must be a positive value');
        if (!firstInvalidFieldId) {
            firstInvalidFieldId = 'currentPortfolio';
        }
        scrollToField(firstInvalidFieldId);
        return {
            valid: false,
            message: 'Portfolio values must be positive'
        };
    }
    
    // Check spending is non-negative
    if (data.desired_spending < 0) {
        showFieldError('desiredSpending', 'Must be a non-negative value');
        if (!firstInvalidFieldId) {
            firstInvalidFieldId = 'desiredSpending';
        }
        scrollToField(firstInvalidFieldId);
        return {
            valid: false,
            message: 'Desired spending cannot be negative'
        };
    }
    
    // Check guardrail ordering
    if (data.lower_guardrail >= data.upper_guardrail) {
        showFieldError('lowerGuardrail', 'Must be less than upper guardrail');
        showFieldError('upperGuardrail', 'Must be greater than lower guardrail');
        if (!firstInvalidFieldId) {
            firstInvalidFieldId = 'lowerGuardrail';
        }
        scrollToField(firstInvalidFieldId);
        return {
            valid: false,
            message: 'Lower guardrail must be less than upper guardrail'
        };
    }

    if (data.future_expenses && Array.isArray(data.future_expenses)) {
        for (const item of data.future_expenses) {
            if (item.type === 'duration') {
                if (!item.duration_years || Number.isNaN(item.duration_years) || item.duration_years <= 0) {
                    if (item.item_id) {
                        showFieldError(`expenseDuration-${item.item_id}`, 'Enter duration in years');
                        scrollToField(`expenseDuration-${item.item_id}`);
                    }
                    return {
                        valid: false,
                        message: 'Duration-based expenses must include a duration in years'
                    };
                }
            }
        }
    }
    
    return { valid: true };
}

function scrollToField(fieldId) {
    if (!fieldId) return;
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
}

// Helper to show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.style.borderColor = '#dc2626';
        
        // Remove existing error message
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error message
        const errorSpan = document.createElement('span');
        errorSpan.className = 'field-error';
        errorSpan.style.color = '#dc2626';
        errorSpan.style.fontSize = '0.85rem';
        errorSpan.style.marginTop = '4px';
        errorSpan.textContent = message;
        field.parentElement.appendChild(errorSpan);
        
        // Reset after 5 seconds
        setTimeout(() => {
            field.style.borderColor = '';
            errorSpan.remove();
        }, 5000);
    }
}

// Clear field errors
function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('input, select').forEach(el => {
        el.style.borderColor = '';
    });
}
