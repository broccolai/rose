# 2026-07-11 St0mp-EE5 High-Weapons Reproduction

Fixture: `rose-debug-vault-export-2026-07-11T10-56-08-018Z.json`

Run with:

```sh
ROSE_BENCH_SCENARIO=hunter-stompees-health-dump-high-weapons ROSE_BENCH_ITERATIONS=3 bun run bench
```

The scenario preserves the captured Hunter configuration that affects the search:

- St0mp-EE5 selected (`2405271937`)
- Health dump stat
- Balanced tuning enabled
- `+20 Health`, `+10 Super`, and `+10 Class` fragment bonuses
- No armor set requirement
- 180 Weapons held as the existing target

The export was captured after its Weapons input had returned to 27, so 180 is the explicit high-Weapons reproduction target rather than a value recovered from the file.

The fixture contains 148 normalized armor items. After class, exotic, and equivalent-item filtering, the workload retains 121 tunable items with a raw slot product of 6,773,760.

## Before Constraint Pruning

| Operation | Cold | Warm median | Warm p95 |
| --- | ---: | ---: | ---: |
| Single Grenade cap | 430ms | 526ms | 527ms |
| All six caps | 2,350ms | 2,371ms | 2,374ms |
| UI two-stage refresh | 2,774ms | 2,790ms | 2,811ms |
| Four independent slider probes | 10,701ms | - | - |
| Build solve | 37ms | 26ms | 29ms |
| First 25 builds | 2.7ms | 0.3ms | 0.3ms |

Independent UI refresh timings from the same 180-Weapons baseline:

| Changed target | Time |
| --- | ---: |
| Melee 25 | 2,688ms |
| Grenade 25 | 2,673ms |
| Super 25 | 2,668ms |
| Class 25 | 2,671ms |

This reproduces the reported interaction problem without network, manifest, profile-normalization, or rendering time. Cap recomputation is the bottleneck; the actual build solve remains fast.

## After Constraint Pruning

The optimized cap search first proves the current targets are feasible, seeds them as cap lower bounds, and prunes with one shared five-mod budget instead of granting every stat five hypothetical mods.

| Scenario | Single cap | All caps | UI refresh | Slider sequence |
| --- | ---: | ---: | ---: | ---: |
| 180 Weapons | 2.7ms | 327ms | 270ms | 1,029ms / 4 probes |
| 180 Weapons + 150 Super | 14ms | 26ms | 29ms | 99ms / 3 probes |

The multi-high-target case now behaves as expected: the selected targets constrain the armor pool enough for a complete exact slider refresh in roughly 29ms. Returned caps are unchanged.
