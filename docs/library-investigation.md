# Library Investigation

This is a codebase-wide map of focused libraries that fit rose without turning the app into a dependency pile. The bias should stay: pure solver stays pure, web code can use focused browser/Solid primitives, and large libraries only come in when they remove a whole class of bugs or boilerplate.

## Current Shape

- `packages/armor-calc` is clean and should stay dependency-light. It is the pure algorithm boundary.
- `packages/armor-bench` is isolated and can take benchmark-only dependencies if useful, but should not leak D2AP compatibility into the solver.
- `src/routes/index.tsx` is the biggest orchestration pressure point: auth, cache loading, manifest loading, profile normalization, target caps, solve, equip flow, debug export, fragments, persistence, and status all meet there.
- `src/features/storage/indexed-json.ts` is hand-written IndexedDB boilerplate.
- `src/features/armor/solver-worker-client.ts` is hand-written worker RPC, request ids, pending maps, cancel/reset, and timing logs.
- `src/features/bungie/api.ts` has manual fetch wrapping plus manual action pacing.
- UI controls are mostly custom Panda/Solid components: sliders, selects, tables, collapsibles, checkboxes, overlays.

## Best Additions

### `valibot`

Use for boundaries where rose reads unknown data:

- persisted calculator preferences
- OAuth token shape
- cached vault snapshot metadata
- test/debug bundle loading
- any manually imported JSON later

Why: the code currently has careful but hand-written sanitizers. Valibot is modular and tree-shakeable, so it fits our “small focused tool” preference better than Zod for browser code.

Adoption path:

1. Replace `sanitizeCalculatorPreferences` with a Valibot schema plus small domain transforms.
2. Add schemas for debug/test bundles so dev/test data fails clearly.
3. Keep Bungie API responses typed from `bungie-api-ts`; only validate persisted/cache boundaries where data may be stale or user-provided.

Source: <https://valibot.dev/>

### `idb-keyval`

Use to replace `src/features/storage/indexed-json.ts`.

Why: rose only needs key/value JSON cache operations right now. `idb-keyval` is tiny, Promise-based, and directly matches `readJsonCache`, `writeJsonCache`, and `deleteJsonCache`.

Adoption path:

1. Keep rose's current `StoredJson<T>` envelope with `updatedAt`.
2. Replace manual `indexedDB.open` transactions with `get`, `set`, and `del`.
3. Use a custom store name so existing cache keys remain grouped under rose.

Source: <https://github.com/jakearchibald/idb-keyval>

### `@solid-primitives/scheduled`

Use for debouncing/throttling UI-driven work:

- preference persistence
- target cap refreshes while sliders move
- copy/equip transient UI state
- any delayed “load cache then refresh” behavior

Why: the package is tiny and lifecycle-aware. It avoids little `setTimeout` islands scattered through components.

Source: <https://primitives.solidjs.community/package/scheduled/>

### `@solid-primitives/event-listener`

Use for browser/global events:

- K + O debug export
- visibility/focus listeners
- escape key handling for overlays
- resize/listener cleanup if we add responsive measurement

Why: these are easy to write manually and also easy to leak or duplicate. This primitive handles cleanup in Solid roots.

Source: <https://primitives.solidjs.community/package/event-listener/>

### `@solid-primitives/storage`

Use selectively for small reactive preferences, not for large Bungie payloads.

Good fit:

- calculator UI preferences
- advanced settings
- source/set display mode

Bad fit:

- manifest cache
- full vault snapshot
- normalized armor indexes

Why: it can persist signals/stores to localStorage or async storage, but our large cache is domain-specific enough that explicit cache modules are still clearer.

Source: <https://primitives.solidjs.community/package/storage/>

## UI Libraries

### `@kobalte/core`

Use focused imports when a custom control starts accumulating accessibility and keyboard behavior.

Best rose targets:

- exotic select/search
- dump stat select
- custom checkbox/switches in Advanced
- dialog/overlay patterns for equip progress or errors
- tooltip for set perk text
- possibly slider, if we can keep our capped track visuals cleanly

Why: Kobalte is unstyled and Solid-native. It gives ARIA/focus/keyboard behavior without forcing a visual system. This is better for rose than a styled component kit.

Do not migrate everything at once. Native tables and simple buttons are fine. Start with select/tooltip/switch if the current custom controls keep feeling brittle.

Source: <https://kobalte.dev/docs/core/overview/introduction/>

### TanStack Table

Use for results only if the table grows beyond the current simple sorting/expansion.

Good fit if we add:

- column visibility
- multiple sorts
- row pinning
- column sizing
- richer expansion state
- filtered retained result pools

Not needed for the current small fragments/set tables. Those are static enough that native table markup is clearer.

Source: <https://tanstack.com/table/latest/docs/framework/solid/solid-table>

### TanStack Virtual

Use only when we deliberately render hundreds or thousands of rows/items.

Good fit:

- very large result browsing
- full armor inventory browser
- all-manifest set/perk explorer

Not needed while we cap visible results and keep set/fragments compact.

Source: <https://tanstack.com/virtual/latest/docs/framework/solid/solid-virtual>

## Data Fetching And Async State

### TanStack Query

This is the big, serious option. Use it if we want to untangle the route-level loading/cache/refresh orchestration.

Good fit:

- current memberships
- profile snapshot refresh
- cached snapshot loading
- manifest version check and fetch
- invalidation after equip/mod changes
- “load cached first, refresh in background” flows

Why: the app has real server state: Bungie owns it, it goes stale, requests can duplicate, and we have cache + refresh + error state. TanStack Query is designed for that exact class of problem.

Tradeoff: this is not a tiny helper. It should be a planned refactor, probably after `idb-keyval` and `valibot`, because those make the cache boundaries cleaner first.

Source: <https://tanstack.com/query/latest/docs/framework/solid/overview>

### TanStack Form

Probably skip for now.

The calculator is not a normal form: sliders, cap calculations, set XOR rules, fragments, and solver constraints are domain interactions. Solid signals plus small model helpers are currently more direct.

Reconsider only if we add lots of text inputs, validation messages, submit states, or multi-step setup.

Source: <https://tanstack.com/form/latest/docs/framework/solid/quick-start>

## Workers And Background Work

### `comlink`

Consider for worker RPC if the worker API grows.

Good fit:

- clean async method calls across worker boundary
- fewer request id/pending map mechanics
- better ergonomics if we split solver, cap checking, and indexing work into separate worker services

Risk:

- rose currently has custom worker pooling and hard cancellation by terminating workers. Comlink can still work, but we should not lose the current reset/cancel behavior accidentally.

Recommendation: keep current worker client until the API expands, then prototype Comlink behind the same `SolverWorkerClient` interface and benchmark it.

Source: <https://github.com/GoogleChromeLabs/comlink>

## Queues And Rate Limiting

### `@henrygd/queue`

Best small candidate for browser-side queues with concurrency and optional rate limiting.

Good fit:

- Bungie transfer/equip/socket action queue
- making action pacing explicit instead of shared `lastActionAtByGroup`
- exposing active/pending counts to the equip overlay

Source: <https://github.com/henrygd/queue>

### `p-limit`

Good when all we need is limited concurrency.

Good fit:

- manifest/normalization helper tasks that should run N at a time
- bounded parallel reads/calculations

Bad fit:

- Bungie timed socket pacing, because it is not a time-based rate limiter.

Source: <https://github.com/sindresorhus/p-limit>

### `bottleneck`

Use only if Bungie action pacing becomes subtle enough to justify a mature rate limiter.

Good fit:

- min time between jobs
- max concurrent jobs
- reservoir-style API throttling
- retries/backoff later

Tradeoff: heavier than the small queue options. It is probably overkill for current rose unless equip/socket handling keeps expanding.

Source: <https://github.com/SGrondin/bottleneck>

## State Management

Avoid adding a global state library right now.

Solid signals/stores are good enough. The main issue is not “we need Redux,” it is that `src/routes/index.tsx` owns too many independent flows. Splitting those flows into feature model modules will help more than adding a state manager.

Possible future options:

- Nano Stores if we need small shared cross-route state.
- XState only if equip flow becomes a real multi-state machine with retries, rollback, partial failure, and resumability.

For now, skip both.

## Solver And Performance

Do not add a performance library to `packages/armor-calc` yet.

Better wins are internal data layout and pruning:

- keep normalized armor indexes built once on load
- precompute per-slot stat vectors, tuning choices, mod potential, exotic grouping, set ids, and masterwork status
- filter impossible armor earlier based on target lower bounds
- reuse candidate indexes between target cap checks and final solve where the constraints match
- keep solver output capped and deterministic

WASM is not the next step. The current problems are search shape, pruning, cache reuse, and UI scheduling. A Rust/WASM solver could be cool later, but only after the TypeScript solver has a stable indexed model to port.

## Suggested Adoption Order

1. Add `valibot` for persisted/debug/test input validation.
2. Add `idb-keyval` and simplify cache storage.
3. Add `@solid-primitives/scheduled` and `@solid-primitives/event-listener` for UI scheduling and global event cleanup.
4. Add Kobalte only for the controls that need better UX/accessibility first: select, switch/checkbox, tooltip.
5. Add a small queue for Bungie equip/socket actions if manual pacing keeps being fragile.
6. Consider TanStack Query as a planned route-data refactor once cache boundaries are cleaner.
7. Consider TanStack Table/Virtual only when result browsing becomes richer than the native table.

## Libraries To Avoid For Now

- Giant styled UI kits: they will fight the custom Destiny-ish visual direction.
- Full state managers: the app needs decomposition, not a global store.
- General utility libraries like Lodash: native JS/TS is enough here.
- Date libraries: rose only formats timestamps right now.
- Form libraries: current controls are domain widgets, not ordinary forms.
- WASM solver: not until the indexed TypeScript solver design is exhausted and benchmarked.
