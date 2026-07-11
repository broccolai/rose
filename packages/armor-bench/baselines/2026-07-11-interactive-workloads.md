# 2026-07-11 Interactive Workloads

Fixture: `rose-debug-vault-export-2026-07-06T00-25-57-760Z.json`

The fixture contains 276 normalized items with real tuning options. Timings below are representative warm values from `bun run bench:workloads`; slider sequences are single cold runs.

| Scenario | Single slider | Combined caps | UI refresh | Sequence | Solve | First 25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warlock, no exotic, Health dump | 19ms | 4,475ms | 3,886ms | 5,712ms | 20ms | 0.3ms |
| Warlock, Nezarec's Sin | 85ms | 244ms | 294ms | 1,036ms | 20ms | 0.3ms |
| Warlock, Transversive Steps, Seventh Seraph 2pc | 142ms | 150ms | 148ms | 613ms | 20ms | 0.2ms |
| Hunter, Fortune's Favor, fragment bonuses | 0.5ms | 5ms | 5ms | 16ms | 4ms | 0.1ms |
| Warlock, Seventh Seraph 4pc | 15ms | 50ms | 50ms | 137ms | 27ms | 0.3ms |
| Titan, no dump | 13ms | 284ms | 224ms | 396ms | 6ms | 0.1ms |

Opt-in balanced-tuning stress result:

| Scenario | Single slider | Combined caps | UI refresh | Sequence | Solve | First 25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warlock, Health dump, balanced tuning | 141ms | 15,001ms | 13,607ms | 29,596ms | 37ms | 0.4ms |

The dominant interactive cost is stat-cap recomputation, not build materialization. Filters that reduce compatible armor or constrain sets substantially reduce cap time.
