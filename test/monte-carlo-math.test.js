import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MonteCarloSimulation } from '../docs/js/logic/MonteCarloSimulation.js';
import { BaseReturnGenerator } from '../docs/js/logic/BaseReturnGenerator.js';

// These tests pin the deterministic MC math so the expense/min-max fixes
// can be shown NOT to touch return generation, volatility, or percentiles.

const gen = new BaseReturnGenerator();

test('expected return is the weighted arithmetic mean', () => {
    // 60/30/10 with means 10% / 5% / 3%
    assert.ok(Math.abs(gen.getExpectedReturn(60, 30, 10) - 0.078) < 1e-12);
    assert.ok(Math.abs(gen.getExpectedReturn(100, 0, 0) - 0.10) < 1e-12);
    assert.ok(Math.abs(gen.getExpectedReturn(0, 0, 100) - 0.03) < 1e-12);
});

test('portfolio volatility matches the covariance formula', () => {
    // independently recompute for 60/30/10
    const wS = 0.6, wB = 0.3, wC = 0.1;
    const sdS = 0.20, sdB = 0.06, sdC = 0.01;
    const variance =
        (wS * sdS) ** 2 + (wB * sdB) ** 2 + (wC * sdC) ** 2 +
        2 * wS * wB * sdS * sdB * 0.1 +
        2 * wS * wC * sdS * sdC * 0.0 +
        2 * wB * wC * sdB * sdC * 0.2;
    assert.ok(Math.abs(gen.getPortfolioVolatility(60, 30, 10) - Math.sqrt(variance)) < 1e-12);
});

// Minimal sim instance for testing the pure percentile helpers directly.
function makeSim() {
    return new MonteCarloSimulation(
        null, 1_000_000, 40_000, 65, 65, 30, 60, 30, 10, 0.0075, 1000,
    );
}

test('getPercentile interpolates linearly on a known sorted set', () => {
    const sim = makeSim();
    const v = [0, 10, 20, 30, 40]; // count 5
    assert.equal(sim.getPercentile(v, 0), 0);
    assert.equal(sim.getPercentile(v, 100), 40);
    assert.equal(sim.getPercentile(v, 50), 20);
    // index = 0.25*4 = 1.0 -> exactly 10
    assert.equal(sim.getPercentile(v, 25), 10);
    // index = 0.10*4 = 0.4 -> 0*(0.6)+10*(0.4) = 4
    assert.ok(Math.abs(sim.getPercentile(v, 10) - 4) < 1e-12);
});

test('min/max are the sorted endpoints (deterministic)', () => {
    const sim = makeSim();
    sim.simulationResults = [500, 100, 900, 300, 700].map((v) => ({ final_portfolio_value: v }));
    const p = sim.calculatePercentiles();
    assert.equal(p.min, 100);
    assert.equal(p.max, 900);
    assert.equal(p.p50, 500);
});

test('calculatePercentiles does not RangeError on large result sets (spread-overflow regression)', () => {
    const sim = makeSim();
    const N = 200_000; // large enough that Math.min(...arr) would throw
    sim.simulationResults = new Array(N);
    for (let i = 0; i < N; i++) sim.simulationResults[i] = { final_portfolio_value: i };
    const p = sim.calculatePercentiles();
    assert.equal(p.min, 0);
    assert.equal(p.max, N - 1);
});

test('empty result set yields zeroed min/max instead of Infinity', () => {
    const sim = makeSim();
    sim.simulationResults = [];
    const p = sim.calculatePercentiles();
    assert.equal(p.min, 0);
    assert.equal(p.max, 0);
});
