#!/usr/bin/env node

/**
 * Risk-Based Guardrail Withdrawal Calculator — Node 24 CLI
 *
 * Reads JSON input from --input <file> or stdin, validates it,
 * runs the Monte Carlo guardrail calculation, and emits raw JSON
 * to stdout.
 *
 * Usage:
 *   node guardrail.js --input params.json [--enhanced] [--pretty]
 *   cat params.json | node guardrail.js [--enhanced] [--pretty]
 *   node guardrail.js --schema input
 *   node guardrail.js --schema output
 *   node guardrail.js --help
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { GuardrailCalculator } from '../docs/js/logic/GuardrailCalculator.js';
import { validate } from './validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Argument parsing ────────────────────────────────────────────────
const { values: args } = parseArgs({
    options: {
        input:    { type: 'string',  short: 'i' },
        enhanced: { type: 'boolean', short: 'e', default: false },
        pretty:   { type: 'boolean', short: 'p', default: false },
        schema:   { type: 'string',  short: 's' },
        help:     { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
});

// ─── --help ──────────────────────────────────────────────────────────
if (args.help) {
    const help = `
Risk-Based Guardrail Withdrawal Calculator CLI

USAGE
  node guardrail.js --input <file> [--enhanced] [--pretty]
  cat params.json | node guardrail.js [--enhanced] [--pretty]

OPTIONS
  -i, --input <file>   Read JSON input from a file (default: stdin)
  -e, --enhanced       Also run enhanced Monte Carlo (mean-reverting returns)
  -p, --pretty         Pretty-print JSON output
  -s, --schema <type>  Print JSON Schema and exit. <type> is "input" or "output"
  -h, --help           Show this help message

EXAMPLES
  # Run with a file
  node guardrail.js --input params.json --pretty

  # Pipe from stdin
  cat params.json | node guardrail.js --enhanced --pretty

  # View the input schema
  node guardrail.js --schema input

OUTPUT
  JSON object with "results" (always) and "enhancedResults" (when --enhanced
  or enhanced_mc_enabled is true). Use --schema output to see the full shape.

  Calculator warnings (e.g. unusual planning horizon) are emitted to stderr.
  Exit code 0 on success, 1 on validation or runtime error.
`.trimStart();
    process.stdout.write(help);
    process.exit(0);
}

// ─── --schema ────────────────────────────────────────────────────────
if (args.schema) {
    const schemaType = args.schema.toLowerCase();
    if (schemaType !== 'input' && schemaType !== 'output') {
        process.stderr.write('Error: --schema must be "input" or "output"\n');
        process.exit(1);
    }
    const schemaPath = resolve(__dirname, 'schemas', `${schemaType}-schema.json`);
    const schemaContent = await readFile(schemaPath, 'utf-8');
    // Always pretty-print schemas for readability
    process.stdout.write(JSON.stringify(JSON.parse(schemaContent), null, 2) + '\n');
    process.exit(0);
}

// ─── Read input ──────────────────────────────────────────────────────
let rawInput;

if (args.input) {
    try {
        rawInput = await readFile(args.input, 'utf-8');
    } catch (err) {
        process.stderr.write(`Error reading file "${args.input}": ${err.message}\n`);
        process.exit(1);
    }
} else {
    // Read from stdin
    if (process.stdin.isTTY) {
        process.stderr.write('Error: No input. Provide --input <file> or pipe JSON to stdin.\nRun with --help for usage.\n');
        process.exit(1);
    }
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    rawInput = Buffer.concat(chunks).toString('utf-8');
}

// ─── Parse JSON ──────────────────────────────────────────────────────
let params;
try {
    params = JSON.parse(rawInput);
} catch (err) {
    process.stderr.write(`Error: Invalid JSON input: ${err.message}\n`);
    process.exit(1);
}

// ─── Validate ────────────────────────────────────────────────────────
const validation = validate(params);
if (!validation.valid) {
    process.stderr.write(JSON.stringify({ error: validation.message }) + '\n');
    process.exit(1);
}

// ─── Run calculation ─────────────────────────────────────────────────
try {
    const calculator = new GuardrailCalculator();
    const results = calculator.calculate(params);

    let enhancedResults = null;
    const runEnhanced = args.enhanced || params.enhanced_mc_enabled;
    if (runEnhanced) {
        enhancedResults = calculator.calculateEnhanced(params);
    }

    const output = { results, enhancedResults };
    const json = args.pretty
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output);

    process.stdout.write(json + '\n');
    process.exit(0);
} catch (err) {
    process.stderr.write(JSON.stringify({ error: err.message, stack: err.stack }) + '\n');
    process.exit(1);
}
