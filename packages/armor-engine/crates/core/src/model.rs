mod input;
mod output;

/// Number of armor stats in every compact stat array.
pub const STAT_COUNT: usize = 6;
/// Number of equipped armor slots in every build.
pub const SLOT_COUNT: usize = 5;
/// Maximum displayed value for one armor stat.
pub const MAX_STAT: i16 = 200;
/// Wire value used when no mod or tuning choice is selected.
pub const NO_CHOICE: i16 = -1;
/// Compact stat order: Health, Melee, Grenade, Super, Class, Weapons.
pub type Stats = [i16; STAT_COUNT];

pub use input::{
    AdjustmentInput, CapRequest, ConstraintsInput, ItemInput, PlanningProfileInput,
    PlanningRollInput, ProfileInput, SetRequirementInput, SolveRequest, SortInput,
};
pub use output::{
    BuildOutput, CapOutput, PlanningProfileSummary, ProfileSummary, SearchMetrics, SolveOutput,
};
