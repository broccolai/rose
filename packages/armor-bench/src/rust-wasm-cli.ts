import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLatestInteractiveBenchmarkBundlePath } from './bundle';
import { interactiveBenchmarkScenarios } from './interactive-scenarios';
import { runRustWasmBenchmark } from './rust-wasm-runner';

const argumentsList = process.argv.slice(2);
const explicitBundle = argumentsList[0]?.endsWith('.json') ? resolve(argumentsList.shift() as string) : null;
const bundlePath = explicitBundle ?? getLatestInteractiveBenchmarkBundlePath();
if (!bundlePath) {
    throw new Error('No interactive benchmark bundle is available.');
}
const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as Parameters<typeof runRustWasmBenchmark>[0];
const requestedIds = new Set(argumentsList);
const scenarios = interactiveBenchmarkScenarios.filter((scenario) => requestedIds.size === 0 || requestedIds.has(scenario.id));

console.log(`Rust/Wasm benchmark: ${bundlePath}\n`);
for (const scenario of scenarios) {
    const result = runRustWasmBenchmark(bundle, scenario);
    console.log(scenario.name);
    console.log(`  init      ${result.initializationMs.toFixed(2)} ms`);
    console.log(`  caps      ${result.caps.medianMs.toFixed(2)} ms`);
    console.log(`  solve     ${result.solve.medianMs.toFixed(2)} ms`);
    console.log(
        `  memory    ${result.wasmMemoryMiB.toFixed(2)} MiB Wasm · ${(result.compactProfileBytes / 1024).toFixed(1)} KiB profile · ${result.requestBytes} B request`
    );
    console.log(`  result    caps ${JSON.stringify(result.capResult)} · valid builds ${result.solveResult.validBuildCount}`);
}
