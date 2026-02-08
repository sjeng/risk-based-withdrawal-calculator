export const Config = {
    monte_carlo: {
        default_iterations: 10000,
        min_iterations: 100,
        max_iterations: 100000,
    },
    
    guardrails: {
        default_lower: 80.0,
        default_upper: 95.0,
        default_target: 90.0,
        default_adjustment: 10.0,
        min_lower: 1.0,
        max_upper: 99.0,
    },
    
    return_assumptions: {
        stocks: {
            mean: 0.10,      // 10% annual return
            std_dev: 0.20,   // 20% standard deviation
        },
        bonds: {
            mean: 0.05,      // 5% annual return
            std_dev: 0.06,   // 6% standard deviation
        },
        cash: {
            mean: 0.03,      // 3% annual return
            std_dev: 0.01,   // 1% standard deviation
        },
    },
    
    correlations: {
        stocks_bonds: 0.1,    // Low positive correlation
        stocks_cash: 0.0,     // Uncorrelated
        bonds_cash: 0.2,      // Interest rate sensitivity
    },

    enhanced_mc: {
        default_autocorrelation: -0.10,  // Conservative mean-reversion estimate (Poterba & Summers 1988)
        min_autocorrelation: -0.40,
        max_autocorrelation: 0.0,
    },
    
    defaults: {
        inflation_rate: 0.025,  // 2.5%
        annual_fee: 0.0075,     // 0.75%
        planning_horizon: 30,    // years
    },
};
