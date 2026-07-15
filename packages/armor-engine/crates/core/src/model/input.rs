use serde::Deserialize;

use super::Stats;

/// Normalized owned armor loaded once when constructing an [`crate::ArmorEngine`].
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub items: Vec<ItemInput>,
}

/// Legal armor-roll templates loaded once when constructing an [`crate::ArmorPlanner`].
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanningProfileInput {
    pub rolls: Vec<PlanningRollInput>,
}

/// One legal stat roll and its available adjustments.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanningRollInput {
    pub source_index: u32,
    pub stable_id: String,
    pub base_stats: Stats,
    pub stat_mods: Vec<AdjustmentInput>,
    pub tunings: Vec<AdjustmentInput>,
}

/// One normalized armor candidate.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemInput {
    pub source_index: u32,
    pub stable_id: String,
    pub item_hash: u32,
    pub slot: u8,
    pub class_type: u8,
    pub is_exotic: bool,
    pub exotic_variant_id: Option<u32>,
    pub set_id: Option<u32>,
    pub base_stats: Stats,
    pub stat_mods: Vec<AdjustmentInput>,
    pub tunings: Vec<AdjustmentInput>,
}

/// One selectable mod or tuning effect.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdjustmentInput {
    pub source_index: u16,
    pub deltas: Stats,
}

/// Constraints shared by cap calculations and build solves.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintsInput {
    pub class_type: u8,
    pub selected_exotic_item_hash: Option<u32>,
    pub selected_exotic_variant_id: Option<u32>,
    pub dump_stat: Option<u8>,
    pub allow_balanced_tuning: bool,
    pub targets: Stats,
    pub stat_bonuses: Stats,
    pub set_requirements: Vec<SetRequirementInput>,
}

/// Minimum number of equipped pieces required from one armor set.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SetRequirementInput {
    pub set_id: u32,
    pub required_pieces: u8,
}

/// Compact result ordering supplied by the caller.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SortInput {
    pub key: u8,
    pub descending: bool,
}

/// A build-search request.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SolveRequest {
    #[serde(flatten)]
    pub constraints: ConstraintsInput,
    pub max_results: usize,
    pub result_sort: Option<SortInput>,
    pub stop_when_result_limit_reached: bool,
}

/// An exact reachable-cap request for a subset of stats.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapRequest {
    #[serde(flatten)]
    pub constraints: ConstraintsInput,
    pub requested_stats: Vec<u8>,
}
