# Weapon Data And Calculation Notes

Rose's Weapons page is split into three layers so catalog refreshes, formula
work, and interface changes can move independently:

- `scripts/build-weapon-catalog.ts` compacts the live English Bungie manifest
  into `public/data/weapon-catalog.json`.
- `packages/weapon-engine` vendors D2Foundry's Oracle Engine and exposes its
  stat and TTK calculations through WebAssembly.
- `src/features/weapons` owns selection URLs, filtering, compare persistence,
  calculation coverage, and the Solid UI.

The browser needs no Bungie login. Catalog generation needs
`VITE_BUNGIE_API_KEY`, but the generated catalog is served as a static asset.

## Arsenal Search

The arsenal uses a compact query grammar based on D2Foundry's public
[search schema](https://github.com/d2foundry/search) and archived advanced
search documentation. Unqualified text matches weapon names. Supported fields
are `name:`, `weapon:`/`type:`, `frame:`, `perk:`/`trait:`, `trait_1:`,
`trait_2:`, `source:`, `ammo:`, `energy:`/`element:`, `slot:`, `rarity:`,
`rpm:`, and `hash:`. Boolean queries include `is:craftable`,
`is:adept`, rarity, ammo, element, and slot values.

Whitespace combines clauses, `|` matches either value, commas require every
value in a field, `-` or `!` negates a clause, and quotes preserve spaces. For
example, `is:craftable weapon:"hand cannon" perk:opening,storm` finds
craftable hand cannons whose perk pools include both terms. `Shift+K` and the
standard `Ctrl/Cmd+K` shortcuts focus the search field.

## Confirmed Sources

### Bungie manifest

Names, icons, weapon stats, socket choices, perk definitions, and collectible
source text come from the current Bungie manifest. Generate a fresh catalog
after a manifest update:

```sh
bun run weapons:catalog
```

The generated file records the manifest version and generation time. Socket
choices are constrained by Bungie's socket-type categories, every initial plug
is retained, and masterwork choices are derived from observed initial rolls in
the same weapon type and intrinsic family. This avoids offering stat
masterworks that do not exist for that family.

The compact catalog includes Bungie's stat-group interpolation curves. Raw
investment stats are supplied to Oracle for formulas such as magazine size,
while the visible stat sheet transforms both base and perk-adjusted values
through Bungie's display curve. This matters for reversed scales such as bow
draw time. The UI does not infer damage formulas from manifest descriptions.

### D2Foundry Oracle Engine

`packages/weapon-engine` is based on
[Oracle Engine](https://github.com/d2foundry/oracle_engine) commit
`dcd0c7d302b056ffbb532edcb711d724a17ca8c1`, upstream version `8.2.6` from
2026-05-19. Its Unlicense and MIT license files are retained in the package.
See `packages/weapon-engine/UPSTREAM.md` for the exact Rose changes.

Rose reports calculation coverage explicitly:

- **Full formula** means Oracle knows the weapon archetype and every selected
  trait has an implemented Oracle modifier.
- **Partial formula** means the base archetype is supported but at least one
  selected trait is not represented by Oracle.
- **Unavailable** means Oracle has no usable formula for that weapon. Rose also
  downgrades zero-damage and sentinel kill-loop outputs instead of presenting
  them as valid calculations.

Partial results remain visible, but are labelled and name the unsupported
traits. Rose does not convert perk description text into guessed math.

Rebuild the checked-in browser module with:

```sh
bun run weapons:wasm
```

TTK is a PvP result. PvE mode reports the Oracle damage profile and weapon
metrics without presenting a PvP kill time as though it were a PvE result.
Fusion and linear-fusion TTK includes the initial charge and the inter-volley
charge/cooldown; ordinary weapons retain zero time to the first projectile.

### Coverage audit

Run the production adapter against every catalog entry in both modes with:

```sh
bun run weapons:audit
```

For manifest `244213.26.06.29.2000-1-bnet.65583`, generated 2026-07-14, the
audit checked 2,208 weapons with zero invariant errors: 332 full, 1,641
partial, and 235 unavailable, for 1,973 usable formulas (89.4%). The unavailable
set includes all 109 Swords because Oracle does not model sword attacks, plus
unsupported new frames and specialty projectile/exotic damage profiles. The
audit also reports 249 catalog plugs with implemented modifiers and 196
interactive effect definitions. These counts describe the pinned Oracle
revision, not a claim that unsupported formulas have been guessed.

### Current sandbox values

[Destiny Update 9.0.0.1](https://www.bungie.net/7/en/News/Article/destiny_update_9_0_0_1)
confirms that former 100 Resilience effects became the Guardian default, that
Weapons 101-200 grants a 0-6% PvP weapon-damage bonus, and that Class 101-200
can grant a 0-10 point PvP overshield on class ability use. Rose therefore
models the Weapons bonus as a linear 1.00-1.06 scalar and exposes overshield as
an explicit target input.

The default target health is 230, inherited from the former maximum-Resilience
baseline used by Oracle. The current exact baseline was not stated directly in
the source above, so health remains editable and this value is an assumption,
not a hidden constant presented as confirmed fact.

## Product References

The interaction model was reconstructed from the archived public
[D2Foundry roll editor documentation](https://d2foundry.gg/docs/features/roll-editor)
and [compare documentation](https://d2foundry.gg/docs/features/compare). The
compact catalog, immediate filtering, local state, and login-free posture were
informed by the [destiny.report guide](https://destiny.report/guide) and
[about page](https://destiny.report/about).

[D2TTK](https://d2ttk.com/) was used as a current product reference only. Rose
does not copy its values or treat it as a canonical data feed.

## Deliberately Not Imported

### Destiny Clarity

The live Clarity database is not bundled. Clarity's
[partnership requirements](https://www.d2clarity.com/partnerships) require a
public integration to arrange access, attribution, and update behavior. Rose
uses Oracle's checked-in data only and must not copy the live Clarity database
until that agreement exists.

### Destiny Data Compendium

The [Destiny Data Compendium](https://www.destiny2.science/) is valuable human
research, but no clear machine-readable redistribution license or stable API
was confirmed. Rose does not scrape or redistribute its sheet.

## Open Verification Work

- Arrange a Clarity partnership before adding live Clarity descriptions or
  numerical effects.
- Obtain permission and define versioning before importing any Destiny Data
  Compendium values.
- Refresh Oracle from upstream and revalidate archetype/perk coverage after
  the pinned 2026-05-19 revision.
- Confirm the exact current base Guardian health with a primary source or
  repeatable in-game capture; update the editable default if needed.
- Add golden in-game captures for representative optimal, body, burst, charge,
  enhanced-perk, overshield, and 101-200 Weapons-stat TTK cases.
- Define and test a repeatable refresh for Oracle's enhanced-perk and intrinsic
  mappings before changing their checked-in cache.
- Confirm DIM's current public roll-export URL or API contract before adding
  export. Sharing Rose URLs and local compare are implemented; DIM export is
  intentionally omitted rather than guessed.
