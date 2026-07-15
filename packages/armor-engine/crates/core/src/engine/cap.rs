use crate::adjustments::{AdjustmentProblem, AllocationCache, update_adjustment_caps};
use crate::domain::{Stat, StatValues};
use crate::item::Item;
use crate::model::{CapOutput, MAX_STAT, SLOT_COUNT, SearchMetrics};
use crate::request::CapQuery;

use super::bounds::any_cap_can_improve;
use super::search::CombinationEvaluator;

pub(super) struct CapSession<'a> {
    items: &'a [Item],
    cache: &'a mut AllocationCache,
    query: &'a CapQuery,
    caps: StatValues,
    metrics: SearchMetrics,
}

impl<'a> CapSession<'a> {
    pub fn new(items: &'a [Item], cache: &'a mut AllocationCache, query: &'a CapQuery) -> Self {
        Self {
            items,
            cache,
            query,
            caps: StatValues::ZERO,
            metrics: SearchMetrics::default(),
        }
    }

    pub fn finish(mut self) -> CapOutput {
        if let Some(dump_stat) = self.query.constraints.dump_stat {
            self.caps[dump_stat] = 0;
        }

        CapOutput {
            caps: self.caps.into_array(),
            search: self.metrics,
        }
    }

    fn complete(&self) -> bool {
        Stat::ALL.into_iter().all(|stat| {
            !self.query.requested_stats.contains(stat)
                || self.query.constraints.is_dump_stat(stat)
                || self.caps[stat] >= MAX_STAT
        })
    }
}

impl CombinationEvaluator for CapSession<'_> {
    fn should_stop(&self) -> bool {
        self.complete()
    }

    fn can_continue(&self, current: &StatValues, remaining: &StatValues) -> bool {
        any_cap_can_improve(
            current,
            remaining,
            &self.query.constraints.targets,
            self.query.constraints.dump_stat,
            self.query.requested_stats,
            &self.caps,
        )
    }

    fn prune(&mut self, combinations: u64) {
        self.metrics.prune_combinations(combinations);
    }

    fn evaluate(&mut self, selected: &[usize; SLOT_COUNT], base_stats: StatValues) {
        self.metrics.evaluate_combination();
        update_adjustment_caps(
            &mut self.caps,
            self.query.requested_stats,
            AdjustmentProblem::from_constraints(
                self.items,
                selected,
                base_stats,
                &self.query.constraints,
            ),
            self.cache,
        );
    }
}
