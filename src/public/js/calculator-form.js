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

// Load saved data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    
    // Auto-save on input changes
    const form = document.getElementById('calculatorForm');
    form.addEventListener('input', debounce(() => {
        saveToLocalStorage();
    }, 1000));
    
    // Also save when income sources change (using MutationObserver if available, or just relying on inputs)
    // Inputs inside income sources will trigger the 'input' event on the form due to bubbling.
    // However, removing an income source (click) isn't an 'input' event.
    // So we should hook into the remove button or observe the container.
    const incomeContainer = document.getElementById('incomeSourcesContainer');
    if (incomeContainer) {
        const observer = new MutationObserver(() => {
             saveToLocalStorage();
        });
        observer.observe(incomeContainer, { childList: true, subtree: true });
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
                    displayResults(response.results);
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

function loadFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        const form = document.getElementById('calculatorForm');

        // Populate basic fields
        for (const [key, value] of Object.entries(data)) {
            if (key === 'income_sources') continue;
            
            // Handle percentages that were divided by 100 in collectFormData
            if (['annual_fee_percentage', 'inflation_rate'].includes(key)) {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) input.value = value * 100;
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

// Collect form data
function collectFormData() {
    const form = document.getElementById('calculatorForm');
    const formData = new FormData(form);
    
    const data = {
        spouse1_age: parseInt(formData.get('spouse1_age')) || null,
        spouse2_age: parseInt(formData.get('spouse2_age')) || null,
        retirement_age: parseInt(formData.get('retirement_age')),
        planning_horizon_years: parseInt(formData.get('planning_horizon_years')),
        initial_portfolio_value: parseFloat(formData.get('initial_portfolio_value')),
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
    
    return data;
}

// Validate form data
function validateFormData(data) {
    // Check allocation totals 100%
    const totalAllocation = data.stock_allocation + data.bond_allocation + data.cash_allocation;
    if (Math.abs(totalAllocation - 100) > 0.01) {
        return {
            valid: false,
            message: 'Asset allocations must total 100%. Current total: ' + totalAllocation.toFixed(1) + '%'
        };
    }
    
    // Check spouse1 age >= age at retirement
    if (data.spouse1_age < data.retirement_age) {
        return {
            valid: false,
            message: 'Current age must be greater than or equal to age at retirement'
        };
    }
    
    // Check positive values
    if (data.current_portfolio_value <= 0 || data.initial_portfolio_value <= 0) {
        return {
            valid: false,
            message: 'Portfolio values must be positive'
        };
    }
    
    // Check spending is non-negative
    if (data.desired_spending < 0) {
        return {
            valid: false,
            message: 'Desired spending cannot be negative'
        };
    }
    
    // Check guardrail ordering
    if (data.lower_guardrail >= data.upper_guardrail) {
        return {
            valid: false,
            message: 'Lower guardrail must be less than upper guardrail'
        };
    }
    
    return { valid: true };
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
