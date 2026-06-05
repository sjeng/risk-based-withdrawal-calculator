import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GuardrailCalculator } from '../docs/js/logic/GuardrailCalculator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/**
 * Snapshot regression over every shipped input file.
 *
 * The cashflow timeline (spending / income / expenses per year) is fully
 * deterministic — it does not depend on the Monte Carlo RNG — so it can be
 * pinned exactly. This guards against unintended changes to the cash-flow,
 * spending-smile, income-offset, or expense-normalization logic.
 *
 * The committed fixture reflects the CORRECTED expense behavior. Regenerate
 * with `node scripts/regen-schedules.mjs` only when a change is intentional.
 */
function walk(d) {
    let out = [];
    for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) out = out.concat(walk(p));
        else if (f.endsWith('.json')) out.push(p);
    }
    return out;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'schedules.json'), 'utf8'));

const files = [...walk(join(root, 'stress-tests')), join(root, 'cli', 'example-input.json')];

// Silence the calculator's soft warnings during the test run.
const origWarn = console.warn;
const origErr = console.error;

test('all shipped inputs reproduce the pinned cashflow schedules', () => {
    console.warn = () => {};
    console.error = () => {};
    try {
        for (const file of files) {
            const key = file.replace(root + (process.platform === 'win32' ? '\\' : '/'), '')
                .replace(/\\/g, '/');
            assert.ok(key in fixture, `fixture missing entry for ${key}`);

            const params = JSON.parse(readFileSync(file, 'utf8'));
            params.monte_carlo_iterations = 100;
            const result = new GuardrailCalculator().calculate(params);
            const actual = result.cashflow_timeline.map((t) => [
                t.age, Math.round(t.spending), Math.round(t.income), Math.round(t.expenses),
            ]);
            assert.deepEqual(actual, fixture[key], `schedule changed for ${key}`);
        }
    } finally {
        console.warn = origWarn;
        console.error = origErr;
    }
});
