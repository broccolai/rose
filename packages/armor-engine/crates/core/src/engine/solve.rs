use crate::adjustments::{AdjustmentProblem, AllocationCache, solve_adjustments};
use crate::domain::StatValues;
use crate::item::Item;
use crate::model::{SLOT_COUNT, SearchMetrics, SolveOutput};
use crate::request::SolveQuery;

use super::bounds::targets_are_reachable;
use super::results::BuildCollector;
use super::search::CombinationEvaluator;

pub(super) struct SolveSession<'a> {
    items: &'a [Item],
    cache: &'a mut AllocationCache,
    query: &'a SolveQuery,
    builds: BuildCollector,
    search: SearchMetrics,
    stopped_at_limit: bool,
}

impl<'a> SolveSession<'a> {
    pub fn new(items: &'a [Item], cache: &'a mut AllocationCache, query: &'a SolveQuery) -> Self {
        Self {
            items,
            cache,
            query,
            builds: BuildCollector::new(query.result_limit, query.sort),
            search: SearchMetrics::default(),
            stopped_at_limit: false,
        }
    }

    pub fn finish(self) -> SolveOutput {
        self.builds.finish(self.stopped_at_limit, self.search)
    }
}

impl CombinationEvaluator for SolveSession<'_> {
    fn should_stop(&self) -> bool {
        self.stopped_at_limit
    }

    fn can_continue(
        &self,
        selected_potential: &StatValues,
        remaining_potential: &StatValues,
    ) -> bool {
        targets_are_reachable(
            selected_potential,
            remaining_potential,
            &self.query.constraints.targets,
            self.query.constraints.dump_stat,
        )
    }

    fn prune(&mut self, combinations: u64) {
        self.search.prune_combinations(combinations);
    }

    fn evaluate(&mut self, selected: &[usize; SLOT_COUNT], base_stats: StatValues) {
        self.search.evaluate_combination();

        let problem = AdjustmentProblem::from_constraints(
            self.items,
            selected,
            base_stats,
            &self.query.constraints,
        );
        let Some(adjustments) = solve_adjustments(problem, self.cache) else {
            self.search.prune_combinations(1);
            return;
        };

        self.builds.record(self.items, selected, &adjustments);
        self.stopped_at_limit = self.query.stop_at_limit && self.builds.reached_limit();
    }
}
