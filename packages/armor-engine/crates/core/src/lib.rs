mod adjustments;
mod domain;
mod engine;
mod error;
mod item;
mod model;
mod request;

pub use engine::ArmorEngine;
pub use error::EngineError;
pub use model::{
    AdjustmentInput, BuildOutput, CapOutput, CapRequest, ConstraintsInput, ItemInput, MAX_STAT,
    NO_CHOICE, ProfileInput, ProfileSummary, SLOT_COUNT, STAT_COUNT, SearchMetrics,
    SetRequirementInput, SolveOutput, SolveRequest, SortInput, Stats,
};
