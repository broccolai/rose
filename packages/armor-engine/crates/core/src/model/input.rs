//! Serialized profile and request inputs accepted by the engine.

use serde::Deserialize;

use super::Stats;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub items: Vec<ItemInput>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanningProfileInput {
    pub rolls: Vec<PlanningRollInput>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanningRollInput {
    pub source_index: u32,
    pub stable_id: String,
    pub base_stats: Stats,
    pub stat_mods: Vec<AdjustmentInput>,
    pub tunings: Vec<AdjustmentInput>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemInput {
    pub source_index: u32,
    pub stable_id: String,
    pub item_hash: u32,
    pub slot: u8,
    pub class_type: u8,
    pub is_exotic: bool,
    pub set_id: Option<u32>,
    pub base_stats: Stats,
    pub stat_mods: Vec<AdjustmentInput>,
    pub tunings: Vec<AdjustmentInput>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdjustmentInput {
    pub source_index: u16,
    pub deltas: Stats,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintsInput {
    pub class_type: u8,
    pub selected_exotic_item_hash: Option<u32>,
    pub dump_stat: Option<u8>,
    pub allow_balanced_tuning: bool,
    pub targets: Stats,
    pub stat_bonuses: Stats,
    pub set_requirements: Vec<SetRequirementInput>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SetRequirementInput {
    pub set_id: u32,
    pub required_pieces: u8,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SortInput {
    pub key: u8,
    pub descending: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SolveRequest {
    #[serde(flatten)]
    pub constraints: ConstraintsInput,
    pub max_results: usize,
    pub result_sort: Option<SortInput>,
    pub stop_when_result_limit_reached: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapRequest {
    #[serde(flatten)]
    pub constraints: ConstraintsInput,
    pub requested_stats: Vec<u8>,
}
