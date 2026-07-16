# Rose Weapon Engine

This package vendors the D2Foundry Oracle Engine at commit
`dcd0c7d302b056ffbb532edcb711d724a17ca8c1` (upstream version `8.2.6`,
2026-05-19).

Upstream: <https://github.com/d2foundry/oracle_engine>

The original project is dual-dedicated/licensed under the included
`LICENSE-UNLICENSE` and `LICENSE-MIT` files.

## Rose changes

- Build from the checked-in enhanced-perk and intrinsic cache without network
  access, source-file mutation, or build-time Git metadata.
- Return whether a weapon formula was found when configuring the engine.
- Expose checks against the actual registered trait modifiers for honest
  partial-support UI.
- Model Stopping Power automatically per projectile from the target's live
  underlying health, including its PvP absolute-health thresholds.
- Add target-health TTK calculations with explicit overshield health and a
  caller-supplied global damage scalar.
- Include the initial charge and inter-volley cooldown in Fusion Rifle and
  Linear Fusion Rifle TTK while preserving Vex Mythoclast's conventional timing.
- Keep the crate outside Rose's Armor Engine workspace because the upstream
  package intentionally targets an older Rust/lint baseline.

Formula and perk coverage otherwise remains that of upstream `8.2.6`. See
`docs/weapon-data.md` for the refresh and verification work still required.
