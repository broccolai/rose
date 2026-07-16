import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

const [command, ...args] = process.argv.slice(2);

if (!command) {
    throw new Error('Expected a Rust command to run.');
}

const rustc = Bun.spawnSync(['rustup', 'which', 'rustc'], {
    stdout: 'pipe',
    stderr: 'inherit'
});

if (rustc.exitCode !== 0) {
    process.exit(rustc.exitCode);
}

const toolchainBin = dirname(rustc.stdout.toString().trim());
const cargoBin = join(process.env['CARGO_HOME'] ?? join(homedir(), '.cargo'), 'bin');

// wasm-pack launches Cargo by name, so the package's pinned rustup toolchain must win over system Rust.
const result = Bun.spawnSync([command, ...args], {
    env: {
        ...process.env,
        PATH: [toolchainBin, cargoBin, process.env['PATH']].filter(Boolean).join(delimiter)
    },
    stdout: 'inherit',
    stderr: 'inherit'
});

process.exit(result.exitCode);
