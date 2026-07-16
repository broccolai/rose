# Armor Benchmark Suite

The interactive workload suite measures the solver against the newest compatible Rose fixture in `data/private`. It accepts both:

- `rose-debug-vault-export-*.json`
- `rose-loaded-benchmark-bundle-*.json`

Network, OAuth, manifest download, and normalization time are intentionally excluded.

## Commands

```sh
bun run bench
```

The default matrix measures one cold call and one warm call for each operation. The full slider sequence runs once because it already contains several consecutive interactions.

```sh
ROSE_BENCH_ITERATIONS=5 ROSE_BENCH_WARMUPS=1 bun run bench
ROSE_BENCH_SCENARIO=warlock-open-dump-health bun run bench
ROSE_BENCH_SCENARIO=warlock-open-dump-health,titan-no-dump bun run bench
ROSE_BENCH_SCENARIO=hunter-stompees-health-dump-high-weapons bun run bench
ROSE_BENCH_SCENARIO=hunter-stompees-health-dump-two-high-stats bun run bench
ROSE_BENCH_INCLUDE_STRESS=1 bun run bench
bun run bench --json
```

## Measurements

- `single slider`: cap for the stat the user just changed.
- `combined slider caps`: all six caps in one solver call.
- `UI slider refresh`: the real two-stage UI path, priority cap followed by the remaining caps unless the new target must be clamped.
- `slider sequence`: several consecutive target changes, with each step timed separately.
- `solve total`: capped interactive solve returning at most 5,000 builds.
- `solve first 25`: time until progressive results can first be rendered.

The standard scenarios cover class, exotic, dump stat, no dump stat, real 2-piece and 4-piece set requirements, fragment bonuses, high targets, and impossible slider attempts. Balanced tuning is opt-in because the unfiltered Warlock workload is intentionally slow.

The `hunter-stompees-health-dump-high-weapons` reproduction uses the July 11 debug export's Hunter, St0mp-EE5, Health dump, balanced tuning, and fragment bonuses. It holds Weapons at 180 and probes the other four non-dump stats independently so each step starts from the same targets.

The paired `hunter-stompees-health-dump-two-high-stats` scenario adds a 150 Super target. It protects the expected fast path where multiple high targets sharply constrain the viable armor pool.
