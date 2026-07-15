import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

export const repositoryRoot = join(import.meta.dir, '..');
export const armorEngineRoot = join(repositoryRoot, 'packages/armor-engine');

export const runArmorRustCommand = (command: string, argumentsList: string[]): number => {
    const rustc = Bun.spawnSync(['rustup', 'which', 'rustc'], {
        cwd: armorEngineRoot,
        stdout: 'pipe',
        stderr: 'inherit'
    });
    if (rustc.exitCode !== 0) {
        return rustc.exitCode;
    }

    const toolchainBin = dirname(rustc.stdout.toString().trim());
    const cargoBin = join(process.env['CARGO_HOME'] ?? join(homedir(), '.cargo'), 'bin');
    const result = Bun.spawnSync([command, ...argumentsList], {
        cwd: armorEngineRoot,
        env: {
            ...process.env,
            PATH: [toolchainBin, cargoBin, process.env['PATH']].filter(Boolean).join(delimiter)
        },
        stdout: 'inherit',
        stderr: 'inherit'
    });

    return result.exitCode;
};
