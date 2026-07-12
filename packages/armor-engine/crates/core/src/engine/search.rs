//! Traverses one armor item per slot and prunes impossible branches early.

use crate::domain::StatValues;
use crate::item::Item;
use crate::model::SLOT_COUNT;
use crate::request::Constraints;

use super::candidates::{CandidatePlan, item_potential_without_mods};

pub(super) trait CombinationEvaluator {
    fn should_stop(&self) -> bool;
    fn can_continue(
        &self,
        selected_potential: &StatValues,
        remaining_potential: &StatValues,
    ) -> bool;
    fn prune(&mut self, combinations: u64);
    fn evaluate(&mut self, selected: &[usize; SLOT_COUNT], base_stats: StatValues);
}

pub(super) fn search_plan<E: CombinationEvaluator>(
    items: &[Item],
    constraints: &Constraints,
    plan: &CandidatePlan,
    evaluator: &mut E,
) {
    TraversalContext {
        items,
        constraints,
        plan,
    }
    .run(evaluator);
}

struct TraversalContext<'a> {
    items: &'a [Item],
    constraints: &'a Constraints,
    plan: &'a CandidatePlan,
}

impl TraversalContext<'_> {
    fn run<E: CombinationEvaluator>(&self, evaluator: &mut E) {
        let mut state = SearchState::new(self.constraints.stat_bonuses);
        self.search_slot(evaluator, &mut state, 0);
    }

    fn search_slot<E: CombinationEvaluator>(
        &self,
        evaluator: &mut E,
        state: &mut SearchState,
        slot: usize,
    ) {
        if evaluator.should_stop() {
            return;
        }

        if !evaluator.can_continue(
            &state.selected_potential,
            self.plan.remaining_potential(slot),
        ) || !self.plan.sets_are_reachable(
            self.items,
            &state.selected,
            slot,
            &self.constraints.set_requirements,
        ) {
            evaluator.prune(self.plan.remaining_combinations(slot));
            return;
        }

        if slot == SLOT_COUNT {
            evaluator.evaluate(&state.selected, state.base_stats);
            return;
        }

        for candidate_index in 0..self.plan.candidate_count(slot) {
            let item_index = self.plan.candidate(slot, candidate_index);
            let item = &self.items[item_index];
            let base_stats = item.base_stats;
            let potential = item_potential_without_mods(item, self.constraints);

            state.select(slot, item_index, base_stats, potential);
            self.search_slot(evaluator, state, slot + 1);
            state.deselect(base_stats, potential);

            if evaluator.should_stop() {
                return;
            }
        }
    }
}

struct SearchState {
    selected: [usize; SLOT_COUNT],
    base_stats: StatValues,
    selected_potential: StatValues,
}

impl SearchState {
    fn new(stat_bonuses: StatValues) -> Self {
        Self {
            // Traversal reads only the selected prefix, so untouched slots need no sentinel.
            selected: [0; SLOT_COUNT],
            base_stats: stat_bonuses,
            selected_potential: stat_bonuses,
        }
    }

    fn select(
        &mut self,
        slot: usize,
        item_index: usize,
        base_stats: StatValues,
        potential: StatValues,
    ) {
        self.selected[slot] = item_index;
        self.base_stats += &base_stats;
        self.selected_potential += &potential;
    }

    fn deselect(&mut self, base_stats: StatValues, potential: StatValues) {
        self.base_stats -= &base_stats;
        self.selected_potential -= &potential;
    }
}
