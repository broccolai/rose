//! Owns bounded build retention, ranking, and solve-result materialization.

use std::cmp::Ordering;

use crate::adjustments::AdjustmentPlan;
use crate::item::Item;
use crate::model::{BuildOutput, SLOT_COUNT, SearchMetrics, SolveOutput};
use crate::request::{ResultLimit, SortKey, SortOrder};

pub(super) struct BuildCollector {
    retained: Vec<RetainedBuild>,
    valid_build_count: u64,
    limit: ResultLimit,
    sort: Option<SortOrder>,
}

impl BuildCollector {
    pub fn new(limit: ResultLimit, sort: Option<SortOrder>) -> Self {
        Self {
            retained: Vec::with_capacity(limit.initial_capacity()),
            valid_build_count: 0,
            limit,
            sort,
        }
    }

    pub fn record(
        &mut self,
        items: &[Item],
        selected: &[usize; SLOT_COUNT],
        adjustments: &AdjustmentPlan,
    ) {
        self.valid_build_count += 1;

        if self.limit.is_zero() {
            return;
        }

        let candidate = RetainedBuild::new(items, selected, adjustments);
        if self.retained.len() < self.limit.value() {
            self.retained.push(candidate);
            return;
        }

        let Some(sort) = self.sort else {
            return;
        };
        let Some(worst_index) = self.worst_index(sort) else {
            return;
        };

        if compare_retained(&candidate, &self.retained[worst_index], Some(sort)).is_lt() {
            self.retained[worst_index] = candidate;
        }
    }

    pub fn reached_limit(&self) -> bool {
        self.limit.reached_by(self.valid_build_count)
    }

    pub fn finish(mut self, stopped_at_limit: bool, search: SearchMetrics) -> SolveOutput {
        if self.valid_build_count == 0 {
            return SolveFailure::NoMatchingBuild.into_output(search);
        }

        self.retained
            .sort_by(|left, right| compare_retained(left, right, self.sort));
        let builds = self
            .retained
            .into_iter()
            .map(|retained| retained.output)
            .collect::<Vec<_>>();
        let retained_count = u64::try_from(builds.len()).unwrap_or(u64::MAX);
        let result_limit_reached = stopped_at_limit || self.valid_build_count > retained_count;

        SolveOutput::success(builds, self.valid_build_count, result_limit_reached, search)
    }

    fn worst_index(&self, sort: SortOrder) -> Option<usize> {
        (0..self.retained.len()).max_by(|left, right| {
            compare_retained(&self.retained[*left], &self.retained[*right], Some(sort))
        })
    }
}

struct RetainedBuild {
    output: BuildOutput,
    item_indexes: [usize; SLOT_COUNT],
}

impl RetainedBuild {
    fn new(items: &[Item], selected: &[usize; SLOT_COUNT], adjustments: &AdjustmentPlan) -> Self {
        Self {
            output: BuildOutput {
                item_indices: selected.map(|index| items[index].source_index),
                stat_mod_indices: adjustments.stat_mod_indices,
                tuning_indices: adjustments.tuning_indices,
                stats: adjustments.stats.into_array(),
                wasted_stats: adjustments.wasted_stats,
                total_stats: adjustments.total_stats,
            },
            item_indexes: *selected,
        }
    }
}

fn compare_retained(
    left: &RetainedBuild,
    right: &RetainedBuild,
    sort: Option<SortOrder>,
) -> Ordering {
    let primary = sort.map_or_else(
        || left.output.wasted_stats.cmp(&right.output.wasted_stats),
        |order| {
            order.compare(
                sort_value(&left.output, order.key()),
                sort_value(&right.output, order.key()),
            )
        },
    );

    primary
        .then_with(|| left.output.wasted_stats.cmp(&right.output.wasted_stats))
        .then_with(|| right.output.total_stats.cmp(&left.output.total_stats))
        .then_with(|| left.item_indexes.cmp(&right.item_indexes))
}

fn sort_value(build: &BuildOutput, key: SortKey) -> i16 {
    match key {
        SortKey::Stat(stat) => build.stats[stat.index()],
        SortKey::Wasted => build.wasted_stats,
        SortKey::Total => build.total_stats,
    }
}

#[derive(Clone, Copy, Debug)]
pub(super) enum SolveFailure {
    MissingArmorSlot,
    NoMatchingBuild,
}

impl SolveFailure {
    const fn message(self) -> &'static str {
        match self {
            Self::MissingArmorSlot => "No compatible armor found for every armor slot.",
            Self::NoMatchingBuild => "No build matched the selected targets and constraints.",
        }
    }

    pub fn into_output(self, search: SearchMetrics) -> SolveOutput {
        SolveOutput::failure(self.message(), search)
    }
}
