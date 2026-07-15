import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dir, '..');
const rustc = Bun.spawnSync(['rustup', 'which', 'rustc'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'inherit'
});
if (rustc.exitCode !== 0) {
    process.exit(rustc.exitCode);
}

const toolchainBin = dirname(rustc.stdout.toString().trim());
const output = join(root, 'src/features/weapons/wasm/generated');
const home = process.env['HOME'] ?? '';
const wasmPackCache = join(home, '.cache', '.wasm-pack');
const cachedBindgenDir = existsSync(wasmPackCache)
    ? readdirSync(wasmPackCache)
          .map((entry) => join(wasmPackCache, entry))
          .find((directory) => existsSync(join(directory, 'wasm-bindgen')))
    : undefined;
const cachedWasmOptDir = existsSync(wasmPackCache)
    ? readdirSync(wasmPackCache)
          .map((entry) => join(wasmPackCache, entry, 'bin'))
          .find((directory) => existsSync(join(directory, 'wasm-opt')))
    : undefined;
const mode = cachedBindgenDir ? ['--mode', 'no-install'] : [];
const build = Bun.spawnSync(
    ['wasm-pack', 'build', 'packages/weapon-engine', '--target', 'web', '--out-dir', output, '--release', ...mode],
    {
        cwd: root,
        env: {
            ...process.env,
            PATH: `${toolchainBin}:${cachedBindgenDir ?? ''}:${cachedWasmOptDir ?? ''}:${home}/.cargo/bin:${home}/.local/bin:${process.env['PATH'] ?? ''}`
        },
        stdout: 'inherit',
        stderr: 'inherit'
    }
);
if (build.exitCode !== 0) {
    process.exit(build.exitCode);
}

rmSync(join(output, '.gitignore'), { force: true });
