import { GuardrailCalculator } from './logic/GuardrailCalculator.js';

self.onmessage = function(e) {
    const params = e.data;
    
    try {
        const calculator = new GuardrailCalculator();
        const results = calculator.calculate(params);
        self.postMessage({ status: 'success', results: results });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message, stack: error.stack });
    }
};
