# Solver Contract

This file is the source of truth for the armor engine. A behavior is not complete until native Rust tests cover its rules and Wasm fixture tests cover the browser boundary.

## Scope

- Support only the current normalized Armor system used by Rose.
- Solve exactly five slots in this order: Helmet, Arms, Chest, Legs, Class Item.
- Track six stats in this order: Health, Melee, Grenade, Super, Class, Weapons.
- Keep the engine independent of Bungie APIs, manifests, OAuth, Solid, browser storage, and item display metadata.
- Treat the normalized input as already classifiable, deduped, stripped of currently socketed stat effects, and fully masterworked unless the web layer applies its fully-masterworked-only filter.
- Never include Armor 2.0 or lower gear tiers. Reject malformed modern items instead of inventing legacy behavior.

## Normalized Profile

- A profile is loaded into the engine once and retained across requests.
- Every armor item has a stable source index, instance id, item hash, slot, class, exotic flag, optional exotic variant id, optional set id, six base stats, stat-mod choices, and tuning choices.
- Equivalent physical copies are represented by the TypeScript item behind the stable source index; the solver operates on one normalized equivalent item.
- All hot data is stored in packed slot-oriented arrays. Strings exist only for deterministic ties and boundary diagnostics.
- Reinitialization happens only when normalized armor changes. Targets and UI selections must not retransmit the profile.

## Acquisition Planning

- Planning uses the fixed catalog of legal, fully masterworked Tier 5 roll profiles instead of the player's owned item profile.
- Each legal roll has one archetype-selected primary stat at 30, one secondary stat at 25, one of the remaining four tertiary stats at 20, and 5 in each other stat.
- Search combinations with replacement because multiple slots may need the same roll profile.
- Search each unordered five-roll multiset exactly once. Slot permutations of the same roll recipe are not distinct plans.
- Reuse the owned solver's exact fragment, mod, tuning, display-cap, target, and ranking rules.
- Keep set identity and non-class-item Exotic identity outside the Rust stat search. The web layer assigns those identities to compatible slots after validating that selected set requirements can occupy disjoint slots.
- Do not claim a gameplay effect from an armor set; set choices remain acquisition constraints only.

## Candidate Rules

- An item is compatible when its class is either the selected class or `Any`.
- Without a selected exotic hash, solve legendary-only builds.
- With a selected exotic hash, require exactly one matching exotic roll in its native slot and legendary armor in every other slot.
- Try every normalized roll of the selected exotic hash.
- When an exotic variant id is selected, try every stat roll with that exact variant and exclude other variants of the same item hash.
- Require exactly one item per slot.
- Enforce every requested armor set count. The engine accepts generic requirements, while the UI limits users to two 2-piece sets or one 4-piece set.
- Set bonuses constrain item counts only. Their gameplay effects do not alter stats.

## Stats

- Normalize every requested target to an integer from 0 through 200.
- Apply fragment/subclass bonuses before armor, mods, and tuning. Bonuses may be negative.
- Ignore the dump stat as a minimum target and report its cap as zero.
- Clamp displayed final stats to 0 through 200.
- Calculate total stats from displayed values, not uncapped internal values.
- A build is valid when every non-dump displayed stat meets its target.

## Stat Mods

- Select at most one stat mod per armor piece, for at most five mods total.
- Support the normalized choices supplied by the profile, including no mod, +5 minor mods, and +10 major mods.
- Prefer +10. Use +5 only when +10 would cross the 200 display ceiling and +5 still reaches the requested target.
- Never assign a mod that the selected normalized item cannot accept.
- Cap search must account for one shared five-mod budget, not five hypothetical mods per stat.

## Tuning

- No tuning is always a valid normalized option when supplied by the item.
- Pair tuning is exactly +5 to one stat and -5 to one other stat.
- With a dump stat and balanced tuning disabled, only pair tuning whose sole negative stat is the dump stat may be used.
- Without a dump stat and balanced tuning disabled, pair tuning may move points between any two stats.
- Balanced tuning is the manifest-provided adjustment with +1 across at least three stats (currently all six on real Tier 5 definitions) and is available only when the request opts in and the item supplies it.
- Balanced tuning must never be selected when disabled.
- Tuning and stat mods are solved together. Greedy choices are not an acceptable correctness shortcut.
- Equivalent aggregate tuning outcomes may be cached by the exact five selected tuning profiles, but returned choices must remain deterministic.

## Target Caps

- Return exact final displayed caps, not threshold approximations.
- Support calculating one requested cap or any requested subset of caps.
- Hold every other current target constant while maximizing one stat.
- If the current target vector is feasible, use it as a proven lower bound for branch-and-bound pruning.
- Impossible current targets must fall back to exact cap calculation and may return a cap below the requested value.
- Cap and solve paths must apply identical mod, tuning, dump, fragment, exotic, class, and set rules.

## Build Results

- Return selected source item indexes, selected mod indexes, selected tuning indexes, six displayed stats, wasted stats, and total stats.
- The TypeScript adapter materializes full `ArmorBuild` objects and active set bonus labels from those indexes.
- Wasted stats exclude the dump stat and equal the sum above requested targets.
- Default ranking is least wasted stats, then highest total stats, then deterministic item-instance-id order.
- Explicit sorting supports any stat, wasted stats, or total stats in ascending or descending order, followed by the same stable tie breakers.
- Respect the rich-result retention limit without materializing every valid build.
- When no explicit sort is requested and interactive stop is enabled, stop after the requested result limit.
- Otherwise count every valid build even when only a bounded result set is retained.
- Report searched combinations, rejected combinations, result-limit state, and deterministic failure reasons.
- The worker/client may request a small first-result solve before the full retained-pool solve to provide progressive UI feedback.

## Runtime Requirements

- Run inside a dedicated persistent worker so calculations never block Solid's main thread.
- Initialize Wasm and transfer normalized armor once per profile.
- Slider messages contain only request constraints and a requested-stat mask.
- Solve responses contain compact indexes and choices, not cloned armor objects.
- Keep one Wasm engine, prepared indexes, and tuning-allocation cache alive after successful requests.
- Ignore stale response ids. Do not destroy a healthy worker after every response.
- A worker replacement must automatically reinitialize from the client's retained compact profile.
- The production bundle must work on static Cloudflare Pages hosting without requiring Rust in the deployment environment.

## Performance And Memory

- No full Cartesian-product materialization.
- No retained list of every valid build.
- Use slot-first packed storage, fixed arrays, and validated domain values in hot loops.
- Cache only bounded reusable profile/allocation data.
- High current targets must make subsequent caps faster through branch-and-bound pruning.
- Measure initialization separately from warm cap and solve requests.
- Benchmark initialization, Wasm calculations, and browser-worker behavior separately when diagnosing performance.
- Keep Rust as the only executable solver so production, tests, and benchmarks cannot quietly choose different algorithms.

## Acceptance Scenarios

- Exact target match.
- Targets requiring major mods.
- Targets requiring minor mods near 200.
- Pair tuning with and without a dump stat.
- Mixed pair-tuning penalty stats without a dump stat.
- Balanced tuning enabled and disabled.
- Tuning plus mods where a greedy selection fails.
- Positive and negative fragment bonuses.
- Two-piece and four-piece set requirements.
- Selected exotic with multiple rolls.
- Legendary-only solve.
- Impossible targets.
- Exact cap/solve constraint parity for one stat and all stats.
- Stable top-N sorting and valid-build counts.
- Progressive first-result snapshot.
- July 6 mixed-class private fixture.
- July 11 Hunter, St0mp-EE5, Health dump, 180 Weapons fixture.
- July 11 two-high-target variant with 180 Weapons and 150 Super.
- Exact future-roll recipe using one legal profile five times.
- Future-roll cap with one shared five-mod budget.
- Unique multiset traversal without duplicate slot permutations.
- Two disjoint planned two-piece sets around a selected Exotic slot.
