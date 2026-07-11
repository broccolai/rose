use std::error::Error;
use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};

pub const STAT_COUNT: usize = 6;
pub const SLOT_COUNT: usize = 5;
pub const MAX_STAT: i16 = 200;
pub const NO_CHOICE: i16 = -1;
pub type Stats = [i16; STAT_COUNT];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub items: Vec<ItemInput>,
}

#[derive(Clone, Debug, Deserialize)]
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

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustmentInput {
    pub source_index: u16,
    pub deltas: Stats,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub class_type: u8,
    pub selected_exotic_item_hash: Option<u32>,
    pub dump_stat: Option<u8>,
    pub allow_balanced_tuning: bool,
    pub targets: Stats,
    pub stat_bonuses: Stats,
    pub set_requirements: Vec<SetRequirementInput>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRequirementInput {
    pub set_id: u32,
    pub required_pieces: u8,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortInput {
    pub key: u8,
    pub descending: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveRequest {
    #[serde(flatten)]
    pub constraints: Request,
    pub max_results: usize,
    pub result_sort: Option<SortInput>,
    pub stop_when_result_limit_reached: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapRequest {
    #[serde(flatten)]
    pub constraints: Request,
    pub requested_stats: Vec<u8>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub item_count: usize,
    pub slot_counts: [usize; SLOT_COUNT],
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapOutput {
    pub caps: Stats,
    pub searched_combinations: u64,
    pub rejected_combinations: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOutput {
    pub item_indices: [u32; SLOT_COUNT],
    pub stat_mod_indices: [i16; SLOT_COUNT],
    pub tuning_indices: [i16; SLOT_COUNT],
    pub stats: Stats,
    pub wasted_stats: i16,
    pub total_stats: i16,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveOutput {
    pub ok: bool,
    pub reason: Option<String>,
    pub builds: Vec<BuildOutput>,
    pub valid_build_count: u64,
    pub returned_build_count: usize,
    pub result_limit_reached: bool,
    pub searched_combinations: u64,
    pub rejected_combinations: u64,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EngineError(pub String);

impl Display for EngineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl Error for EngineError {}

pub(crate) fn clamp_targets(mut values: Stats) -> Stats {
    for value in &mut values {
        *value = (*value).clamp(0, MAX_STAT);
    }
    values
}

pub(crate) fn add_in_place(left: &mut Stats, right: &Stats) {
    for index in 0..STAT_COUNT {
        left[index] += right[index];
    }
}

pub(crate) fn minimum_major_mods(current: i16, target: i16) -> usize {
    usize::try_from((target - current).max(0))
        .unwrap_or_default()
        .div_ceil(10)
}

pub(crate) fn displayed(values: Stats) -> Stats {
    values.map(|value| value.clamp(0, MAX_STAT))
}

pub(crate) fn total(values: &Stats) -> i16 {
    values.iter().sum()
}
