import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { repositoryRoot, runArmorRustCommand } from './armor-rust-toolchain';

const output = join(repositoryRoot, 'src/features/armor/wasm/generated');
const exitCode = runArmorRustCommand('wasm-pack', ['build', 'crates/wasm', '--target', 'web', '--out-dir', output, '--release']);
if (exitCode !== 0) {
    process.exit(exitCode);
}

rmSync(join(output, '.gitignore'), { force: true });
rmSync(join(output, 'README.md'), { force: true });
