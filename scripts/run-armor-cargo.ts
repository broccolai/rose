import { runArmorRustCommand } from './armor-rust-toolchain';

process.exit(runArmorRustCommand('cargo', process.argv.slice(2)));
