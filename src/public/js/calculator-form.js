// Calculator form handling

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
            return;
        }
        
        // Send to API
        const response = await fetch('/api.php?action=calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Calculation failed');
        }
        
        // Display results
        displayResults(result.data);
        
    } catch (error) {
        console.error('Calculation error:', error);
        showError('Error: ' + error.message);
    } finally {
        // Hide loading indicator
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('calculateBtn').disabled = false;
    }
});

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
