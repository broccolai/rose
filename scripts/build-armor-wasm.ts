import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dir, '..');
const toolchain = '1.94.1-aarch64-apple-darwin';
const rustc = Bun.spawnSync(['rustup', 'which', '--toolchain', toolchain, 'rustc'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'inherit'
});
if (rustc.exitCode !== 0) {
    process.exit(rustc.exitCode);
}

const toolchainBin = dirname(rustc.stdout.toString().trim());
const output = join(root, 'src/features/armor/wasm/generated');
const build = Bun.spawnSync(
    ['wasm-pack', 'build', 'packages/armor-engine/crates/wasm', '--target', 'web', '--out-dir', output, '--release'],
    {
        cwd: root,
        env: {
            ...process.env,
            PATH: `${toolchainBin}:${process.env['HOME']}/.cargo/bin:${process.env['PATH'] ?? ''}`
        },
        stdout: 'inherit',
        stderr: 'inherit'
    }
);
if (build.exitCode !== 0) {
    process.exit(build.exitCode);
}

rmSync(join(output, '.gitignore'), { force: true });
