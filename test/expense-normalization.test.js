import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GuardrailCalculator } from '../docs/js/logic/GuardrailCalculator.js';
import { CashFlowModel } from '../docs/js/logic/CashFlowModel.js';
import { SpendingProfile } from '../docs/js/logic/SpendingProfile.js';

const calc = new GuardrailCalculator();
const norm = (item) => calc.normalizeExpense(item);

// ── normalizeExpense: end_age derivation ────────────────────────────────
test('explicit end_age is used verbatim', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 60, end_age: 64 }).end_age, 64);
});

test('duration_years derives end_age = start + duration - 1 when end_age absent', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 66, duration_years: 2, type: 'duration' }).end_age, 67);
});

test('explicit end_age wins over duration_years', () => {
    const r = norm({ name: 'x', annual_amount: 1, start_age: 66, duration_years: 99, end_age: 70, type: 'duration' });
    assert.equal(r.end_age, 70);
});

test('no end_age and no duration -> null', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 66 }).end_age, null);
});

// ── normalizeExpense: one_time derivation ───────────────────────────────
test('type "one_time" -> one_time true', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 68, type: 'one_time' }).one_time, true);
});

test('type "duration" -> one_time false', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 66, duration_years: 2, type: 'duration' }).one_time, false);
});

test('explicit one_time boolean wins over type', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 68, type: 'duration', one_time: true }).one_time, true);
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 68, type: 'one_time', one_time: false }).one_time, false);
});

test('no type but bounded by end_age -> recurring (one_time false)', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 60, end_age: 64 }).one_time, false);
});

test('no type and unbounded -> single charge (schema default one_time)', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 68 }).one_time, true);
});

// ── normalizeExpense: inflation default ─────────────────────────────────
test('inflation_adjusted defaults to false when omitted', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 60 }).inflation_adjusted, false);
});

test('explicit inflation_adjusted true is honored', () => {
    assert.equal(norm({ name: 'x', annual_amount: 1, start_age: 60, inflation_adjusted: true }).inflation_adjusted, true);
});

// ── End-to-end through CashFlowModel (the semantics consumers rely on) ───
function expensesByAge(rawItem, startAge, years, inflation = 0) {
    const cfm = new CashFlowModel(new SpendingProfile('flat'), inflation);
    const n = norm(rawItem);
    cfm.addExpenseItem(n.name, n.annual_amount, n.start_age, n.end_age, n.inflation_adjusted, n.one_time);
    const out = [];
    for (let y = 0; y < years; y++) out.push(Math.round(cfm.getExpensesForYear(startAge + y, y)));
    return out;
}

test('BUG#1 fixed: type:"one_time" (no one_time flag) charges once, not every year', () => {
    const series = expensesByAge({ name: 'o', annual_amount: 50000, start_age: 68, type: 'one_time' }, 65, 8);
    // ages 65..72 ; only age 68 charged
    assert.deepEqual(series, [0, 0, 0, 50000, 0, 0, 0, 0]);
});

test('BUG#2 fixed: duration_years (no end_age) stops after N years', () => {
    const series = expensesByAge({ name: 'd', annual_amount: 10000, start_age: 66, duration_years: 2, type: 'duration' }, 65, 6);
    // ages 65..70 ; charged at 66 and 67 only
    assert.deepEqual(series, [0, 10000, 10000, 0, 0, 0]);
});

test('BUG#3 fixed: omitted inflation flag is NOT inflated', () => {
    const series = expensesByAge({ name: 'f', annual_amount: 10000, start_age: 65, end_age: 99 }, 65, 4, 0.10);
    assert.deepEqual(series, [10000, 10000, 10000, 10000]);
});

test('regression: explicit fields still behave as before (inflation on, recurring to end_age)', () => {
    const series = expensesByAge(
        { name: 'r', annual_amount: 10000, start_age: 65, end_age: 67, inflation_adjusted: true, one_time: false },
        65, 5, 0.10,
    );
    // 10000, 11000, 12100, then ends at end_age 67
    assert.deepEqual(series, [10000, 11000, 12100, 0, 0]);
});
