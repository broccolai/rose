# Rose Armor Engine

Ground-up Rust implementation of Rose's modern Destiny armor solver. The package is split into:

- `crates/core`: pure, deterministic Rust with no browser dependencies.
- `crates/wasm`: the small `wasm-bindgen` boundary used by the persistent browser worker.

The TypeScript solver remains a differential-test oracle and non-worker fallback. See [`SOLVER_CONTRACT.md`](./SOLVER_CONTRACT.md) for the behavioral contract, [`BASELINE.md`](./BASELINE.md) for the frozen pre-Rust timings, and [`RUST_BASELINE.md`](./RUST_BASELINE.md) for the Wasm comparison.

## Commands

```sh
cargo test --workspace
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all --check
bun run armor:wasm
bun run bench:rust
```

The browser binding uses `serde-wasm-bindgen` only at initialization and for compact request/results. The worker constructs one engine per loaded normalized profile and retains its packed armor, indexes, and allocation caches across slider and solve requests.

The generated JS and Wasm are checked in as deployable runtime assets because Cloudflare Pages' standard build image does not include Rust. Regenerate them with the repository's `armor:wasm` script after changing either crate.

## Core Shape

The core intentionally has three stages:

1. `Item::compile` validates and compacts the normalized profile once.
2. `engine` builds one request-specific, slot-oriented candidate plan and walks it with the same depth-first search for caps and builds.
3. `addons` solves the shared five-mod budget and exact tuning assignment only for armor combinations that survive the cheap bounds.

The search does not materialize armor permutations or valid builds. Its suffix stat bounds, set-feasibility check, target-first candidate order, bounded retained-result list, and restricted-tuning allocation cache all skip or avoid measurable combinatorial work. Keep those structures unless a benchmark demonstrates a simpler replacement. The cap/build traversal and basic stat arithmetic are shared so their rules cannot quietly diverge.

References: [wasm-bindgen deployment](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html), [wasm-pack build](https://drager.github.io/wasm-pack/book/commands/build.html), and [`serde-wasm-bindgen`](https://docs.rs/serde-wasm-bindgen/latest/serde_wasm_bindgen/).
