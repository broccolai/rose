# Rose Armor Engine

Rust solver for Destiny 2's current armor system. It finds owned builds, calculates exact reachable stat caps, and plans useful future armor rolls.

The engine accepts normalized armor data. It does not know about Bungie APIs, manifests, OAuth, browser storage, or UI state.

## Crates

- `rose-armor-engine` contains the native solver and public Rust API.
- `rose-armor-wasm` exposes persistent `wasm-bindgen` wrappers for browser workers.

The TypeScript adapter in this repository compacts application data into the engine's numeric wire format. Other consumers can construct the public Rust input types directly.

## Solver Model

Every calculation uses five armor slots and six stats:

```text
Slots: Helmet, Arms, Chest, Legs, Class Item
Stats: Health, Melee, Grenade, Super, Class, Weapons
```

An owned-armor profile is compiled once into slot indexes. Requests then provide only class, exotic, set, stat, mod, and tuning constraints. The solver walks candidates without materializing the Cartesian product, rejects impossible branches with optimistic stat bounds, and retains only the requested result count.

`ArmorPlanner` uses the same adjustment and result logic but searches unique multisets of legal future-roll templates instead of owned items.

The detailed behavioral rules live in [`SOLVER_CONTRACT.md`](./SOLVER_CONTRACT.md).

## Rust API

`ArmorEngine` and `ArmorPlanner` are reusable. Keep an instance alive when running multiple cap or solve requests so its compiled profile and bounded tuning cache can be reused.

```rust,no_run
use rose_armor_engine::{ArmorEngine, CapRequest, EngineError, ProfileInput};

fn calculate(profile: ProfileInput, request: CapRequest) -> Result<(), EngineError> {
    let mut engine = ArmorEngine::new(profile)?;
    let caps = engine.calculate_caps(request)?;

    println!("{:?}", caps.caps);
    Ok(())
}
```

Boundary arrays use the orders shown above. Invalid indexes, duplicate identities, malformed adjustment catalogs, and unsupported constraints return `EngineError` before search begins.

## WebAssembly

The Wasm crate serializes compact inputs and outputs with `serde-wasm-bindgen`. It exposes separate persistent classes for owned armor and future-roll planning.

Build a standalone web package from this directory with:

```sh
wasm-pack build crates/wasm --target web --release
```

Rose checks the generated JS and Wasm into its web app so production does not require a Rust toolchain. Run `bun run generate:wasm` from the repository root to refresh both engines, or `bun run --filter @rose/armor-engine build` to refresh only Armor.

## Development

From this directory:

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
```

The workspace enables Clippy's default, performance, pedantic, and selected restriction lints. Solver changes should preserve cap/solve parity and include native tests for their rules.
