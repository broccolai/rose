//! Serializable values crossing the native and Wasm engine boundary.

mod input;
mod output;

pub const STAT_COUNT: usize = 6;
pub const SLOT_COUNT: usize = 5;
pub const MAX_STAT: i16 = 200;
pub const NO_CHOICE: i16 = -1;
pub type Stats = [i16; STAT_COUNT];

pub use input::{
    AdjustmentInput, CapRequest, ConstraintsInput, ItemInput, PlanningProfileInput,
    PlanningRollInput, ProfileInput, SetRequirementInput, SolveRequest, SortInput,
};
pub use output::{
    BuildOutput, CapOutput, PlanningProfileSummary, ProfileSummary, SearchMetrics, SolveOutput,
};
