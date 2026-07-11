# Rust/Wasm Baseline

Recorded on 2026-07-11 after the ground-up Rust engine and persistent Wasm worker integration. Values are warm medians from five samples after one warm-up. Initialization, network, manifest loading, and normalization are reported separately.

Every listed scenario matched the TypeScript oracle's exact six stat caps, solve success state, and retained valid-build count.

## July 11 St0mp-EE5 Fixture

| Scenario | TypeScript caps | Wasm caps | Speedup | TypeScript solve | Wasm solve | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Health dump, 180 Weapons | 285.44ms | 19.59ms | 14.6x | 26.18ms | 16.35ms | 1.6x |
| Health dump, 180 Weapons + 150 Super | 25.85ms | 22.78ms | 1.1x | 76.51ms | 52.07ms | 1.5x |

Profile initialization was 4.60ms cold and about 1ms warm. The compact profile was 128.0 KiB, each cap request was 200-202 bytes, and Wasm linear memory settled at 1.94 MiB.

## July 6 Mixed-Class Fixture

| Scenario | TypeScript caps | Wasm caps | Speedup | TypeScript solve | Wasm solve | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warlock open, Health dump | 321.49ms | 3.52ms | 91.3x | 19.09ms | 6.13ms | 3.1x |
| Warlock Nezarec high targets | 51.01ms | 1.95ms | 26.2x | 20.73ms | 6.24ms | 3.3x |
| Warlock T-Steps, Seventh Seraph 2pc | 4.36ms | 1.09ms | 4.0x | 19.92ms | 5.21ms | 3.8x |
| Hunter Fortune's Favor + fragments | 0.54ms | 0.10ms | 5.4x | 3.30ms | 1.03ms | 3.2x |
| Warlock Seventh Seraph 4pc | 16.51ms | 2.92ms | 5.7x | 28.46ms | 7.08ms | 4.0x |
| Titan, no dump | 3.51ms | 1.12ms | 3.1x | 6.34ms | 0.86ms | 7.4x |

Across these runs, compact profiles were 42.8-122.5 KiB, cap requests were 194-230 bytes, and Wasm linear memory settled at 2.06 MiB.

## Browser Runtime

- The normalized profile crosses the worker boundary only when the armor profile changes.
- Warm slider and solve requests carry only numeric constraints.
- A healthy worker is retained after every response, preserving Rust indexes and bounded tuning-allocation caches.
- A superseded in-flight computation may still replace the worker because synchronous Wasm cannot be interrupted safely; the retained compact profile is automatically reinitialized for the next request.
- Progressive results use a fast 25-build pass before the retained-pool solve.

Run the comparison with:

```sh
bun run bench:rust
```
