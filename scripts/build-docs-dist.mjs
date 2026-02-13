import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const docsDir = join(rootDir, 'docs');
const distDir = join(rootDir, 'dist');
const chartSourcePath = join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const chartDistPath = join(distDir, 'js', 'vendor', 'chart.umd.js');
const minify = process.argv.includes('--minify');

function toRelativeAssetUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;

  const isExternal = /^(https?:|data:|mailto:|tel:|javascript:|#)/i.test(trimmed);
  if (isExternal || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  const normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `./${normalized}`;
}

function rewriteHtmlForPortableBuild(sourceHtml) {
  let html = sourceHtml;

  html = html.replace(
    /<script\s+src=(['"])https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@[^'"]+\1><\/script>/i,
    '<script src="./js/vendor/chart.umd.js"></script>'
  );

  html = html.replace(/(href|src)=(['"])([^'"]+)\2/gi, (_match, attr, quote, value) => {
    const rewritten = toRelativeAssetUrl(value);
    return `${attr}=${quote}${rewritten}${quote}`;
  });

  if (!html.includes('./js/guardrail-engine.js')) {
    html = html.replace(
      '<script src="./js/calculator-form.js"></script>',
      '<script src="./js/guardrail-engine.js"></script>\n    <script src="./js/calculator-form.js"></script>'
    );
  }

  return html;
}

function rewriteCalculatorFormForPortableBuild(sourceJs) {
  const replacementBlock = `// Initialize calculation runtime (Worker when possible, main-thread fallback for file://)\nlet calculatorWorker = null;\nlet calculatorEngine = null;\n\nfunction createInlineWorkerShim() {\n    return {\n        onmessage: null,\n        onerror: null,\n        postMessage(params) {\n            setTimeout(() => {\n                try {\n                    const results = calculatorEngine.calculate(params);\n                    let enhancedResults = null;\n                    if (params.enhanced_mc_enabled) {\n                        enhancedResults = calculatorEngine.calculateEnhanced(params);\n                    }\n                    this.onmessage?.({\n                        data: { status: 'success', results, enhancedResults }\n                    });\n                } catch (error) {\n                    this.onmessage?.({\n                        data: { status: 'error', message: error.message, stack: error.stack }\n                    });\n                }\n            }, 0);\n        }\n    };\n}\n\nfunction initializeCalculatorRuntime() {\n    const isFileProtocol = window.location.protocol === 'file:';\n\n    if (!isFileProtocol && window.Worker) {\n        try {\n            calculatorWorker = new Worker('./js/worker.classic.js');\n            return;\n        } catch (e) {\n            console.warn('Falling back to inline calculator runtime:', e);\n        }\n    }\n\n    if (window.GuardrailEngine?.GuardrailCalculator) {\n        calculatorEngine = new window.GuardrailEngine.GuardrailCalculator();\n        calculatorWorker = createInlineWorkerShim();\n    } else {\n        console.error('Guardrail engine is not available.');\n    }\n}\n\ninitializeCalculatorRuntime();`;

  const startMarker = '// Initialize Web Worker';
  const endMarker = '// Local Storage Key';
  const startIndex = sourceJs.indexOf(startMarker);
  const endIndex = sourceJs.indexOf(endMarker);

  let rewritten = sourceJs;
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    rewritten = `${sourceJs.slice(0, startIndex)}${replacementBlock}\n\n${sourceJs.slice(endIndex)}`;
  }

  return rewritten.replace(
    /new Worker\('js\/worker\.js',\s*\{\s*type:\s*'module'\s*\}\)/g,
    "new Worker('./js/worker.classic.js')"
  );
}

rmSync(distDir, { recursive: true, force: true });
cpSync(docsDir, distDir, { recursive: true });

if (!existsSync(chartSourcePath)) {
  throw new Error('Chart.js was not found in node_modules. Run npm install before building.');
}

mkdirSync(join(distDir, 'js', 'vendor'), { recursive: true });
cpSync(chartSourcePath, chartDistPath);

await build({
  entryPoints: [join(docsDir, 'js', 'worker.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  outfile: join(distDir, 'js', 'worker.classic.js'),
  minify,
  sourcemap: false,
  logLevel: 'info',
});

await build({
  stdin: {
    contents: "export { GuardrailCalculator } from './docs/js/logic/GuardrailCalculator.js';",
    resolveDir: rootDir,
    sourcefile: 'guardrail-engine-entry.js',
  },
  bundle: true,
  format: 'iife',
  globalName: 'GuardrailEngine',
  platform: 'browser',
  target: ['es2018'],
  outfile: join(distDir, 'js', 'guardrail-engine.js'),
  minify,
  sourcemap: false,
  logLevel: 'silent',
});

const distIndexPath = join(distDir, 'index.html');
const distIndexSource = readFileSync(distIndexPath, 'utf8');
writeFileSync(distIndexPath, rewriteHtmlForPortableBuild(distIndexSource), 'utf8');

const distCalculatorFormPath = join(distDir, 'js', 'calculator-form.js');
const distCalculatorFormSource = readFileSync(distCalculatorFormPath, 'utf8');
writeFileSync(distCalculatorFormPath, rewriteCalculatorFormForPortableBuild(distCalculatorFormSource), 'utf8');

console.log(`Built portable docs dist at: ${distDir}`);
console.log('Open dist/index.html directly in your browser (file://).');
