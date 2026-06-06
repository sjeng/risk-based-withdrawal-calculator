// Regenerate test/fixtures/schedules.json from the shipped input files.
// Run only when a change to cash-flow / expense behavior is intentional:
//   node scripts/regen-schedules.mjs
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GuardrailCalculator } from '../docs/js/logic/GuardrailCalculator.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(d) {
    // The stress-tests corpus is optional / may not be present in every
    // checkout. Tolerate a missing directory instead of throwing ENOENT.
    if (!existsSync(d)) return [];
    let out = [];
    for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) out = out.concat(walk(p));
        else if (f.endsWith('.json')) out.push(p);
    }
    return out;
}

const files = [...walk(join(root, 'stress-tests')), join(root, 'cli', 'example-input.json')].sort();
const snap = {};
const w = console.warn, e = console.error;
console.warn = () => {};
console.error = () => {};
for (const file of files) {
    let j;
    try { j = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    j.monte_carlo_iterations = 100;
    const key = file.replace(root + (process.platform === 'win32' ? '\\' : '/'), '').replace(/\\/g, '/');
    try {
        const r = new GuardrailCalculator().calculate(j);
        snap[key] = r.cashflow_timeline.map((t) => [t.age, Math.round(t.spending), Math.round(t.income), Math.round(t.expenses)]);
    } catch (err) {
        snap[key] = 'ERROR: ' + err.message;
    }
}
console.warn = w;
console.error = e;
writeFileSync(join(root, 'test', 'fixtures', 'schedules.json'), JSON.stringify(snap, null, 1) + '\n');
console.log('wrote fixture with ' + Object.keys(snap).length + ' files');
