# 2026-07-10 After Frontier Refactor

Benchmark taken after adding the set-aware frontier reachability/cap path, batching stat-cap worker requests, and using a hybrid
result-frontier materializer for multi-stat interactive solves.

- Command: `for i in 1 2 3 4 5; do bun run bench:slider-caps; done`
- Median-ish result from five one-shot runs:

```text
priority grenade cap: 5.56ms
all caps via individual calls: 95.83ms
all caps via calculateArmorStatTargetCaps: 81.51ms
```

Representative output:

```text
$ bun packages/armor-bench/src/slider-caps-cli.ts
Warlock armor: 225
Raw slot product: 173,746,944
priority grenade cap via sorted solve: skipped; set ROSE_CAP_BENCH_SORTED_SOLVE=1 to run the known-slow experiment
priority grenade cap: 5.66ms
priority grenade cap result: 155
all caps via individual calls: 95.83ms
individual caps: {"health":0,"melee":0,"grenade":155,"super":0,"class":0,"weapons":60}
all caps via calculateArmorStatTargetCaps: 81.51ms
batch caps: {"health":0,"melee":0,"grenade":155,"super":0,"class":0,"weapons":60}
```

Compared with the before snapshot:

```text
priority grenade cap: 11.29ms -> 5.56ms
all caps via individual calls: 98.34ms -> 95.83ms
all caps via calculateArmorStatTargetCaps: 82.83ms -> 81.51ms
```

Interactive solve benchmark:

- Command: `for i in 1 2 3; do bun run bench:interactive-solve; done`
- Median-ish result from three one-shot runs:

```text
warlock-tsteps-weapons-200: 23.60ms
warlock-tsteps-weapons-100-super-100: 2613.25ms
warlock-tsteps-super-180-two-piece: 3.07ms
```

Exact comparison for the hard multi-stat scenario:

```text
warlock-tsteps-weapons-100-super-100 exact: 12984.62ms
warlock-tsteps-weapons-100-super-100 frontier: 2613.25ms
```

The hybrid solver intentionally keeps one-stat/simple interactive solves on the exact enumerator, because those are already faster than the
materialized frontier.
