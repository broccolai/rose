# 2026-07-10 Before Frontier Refactor

Baseline taken before starting the solver/frontier refactor.

- Commit: `f38a357`
- Working tree: included the exact add-on fallback patch in `packages/armor-calc/src/solver.ts`
- Command: `bun run bench:slider-caps`

```text
$ bun packages/armor-bench/src/slider-caps-cli.ts
Warlock armor: 225
Raw slot product: 173,746,944
priority grenade cap via sorted solve: skipped; set ROSE_CAP_BENCH_SORTED_SOLVE=1 to run the known-slow experiment
priority grenade cap: 11.29ms
priority grenade cap result: 155
all caps via individual calls: 98.34ms
individual caps: {"health":0,"melee":0,"grenade":155,"super":0,"class":0,"weapons":60}
all caps via calculateArmorStatTargetCaps: 82.83ms
batch caps: {"health":0,"melee":0,"grenade":155,"super":0,"class":0,"weapons":60}
```

`bun run bench:d2ap` could not be used for this baseline because the local D2AP sourcemap fixture was missing:

```text
ENOENT: no such file or directory, open '/private/tmp/d2armorpicker-main.js.map'
```
