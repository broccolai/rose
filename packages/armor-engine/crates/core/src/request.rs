//! Validates serialized requests into domain-level solver queries.

mod constraints;
mod query;

pub(crate) use constraints::{Constraints, SetRequirement};
pub(crate) use query::{CapQuery, RequestedStats, ResultLimit, SolveQuery, SortKey, SortOrder};
