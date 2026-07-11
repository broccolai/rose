# Pre-Rust Baseline

Recorded on 2026-07-11 before the Rust engine was introduced. Values are warm medians from five samples after one warm-up. Network, manifest, normalization, worker startup, and structured-clone time are excluded.

## July 11 St0mp-EE5 Fixture

Fixture: `rose-debug-vault-export-2026-07-11T10-56-08-018Z.json`

The prepared Hunter profile retains 121 tunable items from 148 normalized items, with a raw slot product of 6,773,760.

| Scenario | Single cap | Combined caps | UI refresh | Solve | First 25 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Health dump, 180 Weapons | 1.97ms | 285.44ms | 262.12ms | 26.18ms | 0.33ms |
| Health dump, 180 Weapons + 150 Super | 10.97ms | 25.85ms | 29.93ms | 76.51ms | 0.28ms |

Exact caps:

```text
180 Weapons
Health 0, Melee 156, Grenade 158, Super 180, Class 167, Weapons 200

180 Weapons + 150 Super
Health 0, Melee 122, Grenade 100, Super 180, Class 125, Weapons 200
```

## July 6 Mixed-Class Fixture

Fixture: `rose-debug-vault-export-2026-07-06T00-25-57-760Z.json`

| Scenario | Items | Raw product | Single cap | Combined caps | UI refresh | Solve |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warlock open, Health dump | 153 | 26,226,585 | 0.97ms | 321.49ms | 294.60ms | 19.09ms |
| Warlock Nezarec high targets | 147 | 21,436,800 | 0.94ms | 51.01ms | 40.92ms | 20.73ms |
| Warlock T-Steps, Seventh Seraph 2pc | 148 | 22,025,500 | 2.21ms | 4.36ms | 6.20ms | 19.92ms |
| Hunter Fortune's Favor + fragments | 56 | 167,310 | 0.45ms | 0.54ms | 0.73ms | 3.30ms |
| Warlock Seventh Seraph 4pc | 153 | 26,226,585 | 6.01ms | 16.51ms | 17.65ms | 28.46ms |
| Titan, no dump | 61 | 211,680 | 1.45ms | 3.51ms | 3.32ms | 6.34ms |

## Existing Browser Worker Cost

The pre-Rust browser client sends the full nested solver input on every request (about 0.29 MiB for the July 11 prepared scenario), terminates its worker after every result, and consequently discards all WeakMap preparation/allocation caches. Browser end-to-end timing is therefore expected to be slower than the kernel baseline above. The Rust worker comparison must report initialization once and warm request latency separately.
