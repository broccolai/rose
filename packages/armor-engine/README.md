# Rose Armor Engine

Ground-up Rust implementation of Rose's modern Destiny armor solver. The package is split into:

- `crates/core`: pure, deterministic Rust with no browser dependencies.
- `crates/wasm`: the small `wasm-bindgen` boundary used by the persistent browser worker.

Rust is the only solver implementation. `packages/armor-domain` provides shared TypeScript data shapes, while `packages/armor-engine/ts` compacts those shapes for Wasm and materializes compact results for the UI. See [`SOLVER_CONTRACT.md`](./SOLVER_CONTRACT.md) for the behavioral contract, [`BASELINE.md`](./BASELINE.md) for the frozen pre-Rust timings, and [`RUST_BASELINE.md`](./RUST_BASELINE.md) for the original Wasm comparison.

## Commands

```sh
cargo test --workspace
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all --check
bun run armor:wasm
bun run bench:rust
```

The browser binding uses `serde-wasm-bindgen` only at initialization and for compact request/results. The worker constructs one owned-armor engine per loaded normalized profile and one acquisition planner from the fixed legal Tier 5 roll catalog. Both retain their packed data and allocation caches across slider and solve requests.

The generated JS and Wasm are checked in as deployable runtime assets because Cloudflare Pages' standard build image does not include Rust. Regenerate them with the repository's `armor:wasm` script after changing either crate.

## Lint Policy

The workspace treats Clippy's default, performance, and pedantic groups as warnings and CI promotes every warning to an error. It also enables selected high-signal nursery and restriction lints for suspicious grouping, redundant clones, accidental debugging, placeholder implementations, explicit panics, and `unwrap`/`expect` shortcuts. The full nursery and restriction groups are intentionally not enabled because Clippy documents them as unstable or mutually restrictive.

`trivially_copy_pass_by_ref` is the sole broad exception. The solver's five- and six-element arrays represent shared recursive state, where references communicate ownership and mutation more clearly than repeated by-value copies.

## Core Shape

The core intentionally has three stages:

1. Boundary DTOs are converted once into validated domain values and compact items.
2. `engine` builds one request-specific, slot-oriented candidate plan and walks it with the same depth-first search for caps and builds.
3. `adjustments` solves the shared five-mod budget and exact tuning assignment only for armor combinations that survive the cheap bounds.

Acquisition planning shares the same request validation, cap sessions, solve sessions, and adjustment allocator. Its only alternate stage is `engine/planning.rs`, which walks unique five-roll multisets instead of slot-specific owned items. Set and exotic identities are assigned to compatible slots by the TypeScript feature layer because they do not change a legal Tier 5 roll's stats.

The search does not materialize armor permutations or valid builds. Its suffix stat bounds, set-feasibility check, target-first candidate order, bounded retained-result list, and restricted-tuning allocation cache all skip or avoid measurable combinatorial work. Keep those structures unless a benchmark demonstrates a simpler replacement. The cap/build traversal and basic stat arithmetic are shared so their rules cannot quietly diverge.

The serialized types under `model/` deliberately stay plain because they mirror the Wasm boundary. They are converted before entering solver code. The modules under `request/` validate those inputs into `CapQuery` or `SolveQuery`, while `domain/` owns zero-cost values such as `Stat`, `StatMap<T>`, `ArmorSlot`, class compatibility, and shared mod requirements. Compact numeric encodings such as tuning choices remain private behind methods that express their meaning.

## Start Here

You do not need to read every module to change the solver. Pick the path that
matches the work:

### Request Flow

1. `lib.rs` exposes the public Rust API.
2. `request/constraints.rs` and `request/query.rs` validate boundary input into executable queries.
3. `engine.rs` owns the persistent profile and the two public operations.
4. `engine/candidates.rs` prepares five request-specific slot lists.
5. `engine/search.rs` walks those lists once.
6. `engine/cap.rs` or `engine/solve.rs` decides what to do at a surviving leaf.

For future-roll planning, `engine/planning.rs` replaces steps 4 and 5 with an unordered multiset traversal. It sorts rolls for the active targets, uses suffix potential bounds, and never revisits the same five-roll recipe as a different slot permutation.

The supporting engine files each answer one narrower question:

- `engine/profile.rs`: how normalized armor becomes an immutable retained profile and slot index.
- `engine/bounds.rs`: whether an unfinished branch can still succeed.
- `engine/results.rs`: bounded result collection, ranking, and stable failures.

### Mods And Tuning

1. `adjustments.rs` chooses the restricted or unrestricted path.
2. `adjustments/restricted.rs` handles the common single dump-stat case.
3. `adjustments/unrestricted.rs` handles balanced or cross-stat tuning.
4. `adjustments/plan.rs` places mods and ranks the finished assignment.

Only continue into these files when changing the exact tuning search:

- `adjustments/pair_transfer.rs`: reserves mod budget and calculates required transfers.
- `adjustments/pair_transfer/matching.rs`: matches those transfers to legal armor pieces.
- `adjustments/cache.rs`: retains reusable restricted-tuning allocations.
- `adjustments/tuning.rs`: typed tuning decisions and their applied effects.
- `adjustments/mods.rs`: the shared five-piece mod budget.

### Input Compilation

- `item.rs`: the compact item representation used in every hot loop.
- `item/compiler.rs`: converts one normalized item into that representation.
- `item/adjustment.rs`: recognizes supported modern mods and tuning choices.
- `domain.rs`: the shared domain facade.
- `domain/index.rs`: validated stat, slot, class, and compatibility values.
- `domain/stats.rs`: fixed stat maps, constants, and small arithmetic helpers.
- `request/constraints.rs`: validated class, exotic, dump-stat, target, and set constraints.
- `request/query.rs`: requested-stat masks, result limits, and sort semantics.
- `model/input.rs`: serialized profiles and requests.
- `model/output.rs`: serialized summaries and results, including explicit plain-object wire shapes.
- `error.rs`: structured public validation and compilation errors.

### Behavioral Tests

- `tests/basic_stats.rs`: base stats, fragments, and shared mod budget.
- `tests/tuning.rs`: dump-stat, unrestricted, and balanced tuning.
- `tests/constraints.rs`: sets, exotic rolls, and cap/solve parity.
- `tests/results.rs`: bounded retention, sorting, and stable failures.
- `tests/validation.rs`: malformed profile and request rejection.
- `tests/planning.rs`: legal-roll recipes, multiset traversal, and shared mod-budget caps.
- `tests/support`: small synthetic armor builders shared by those suites.

References: [wasm-bindgen deployment](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html), [wasm-pack build](https://drager.github.io/wasm-pack/book/commands/build.html), and [`serde-wasm-bindgen`](https://docs.rs/serde-wasm-bindgen/latest/serde_wasm_bindgen/).
