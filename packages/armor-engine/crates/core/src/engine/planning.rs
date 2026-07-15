use crate::domain::{Stat, StatValues};
use crate::item::Item;
use crate::model::SLOT_COUNT;
use crate::request::{Constraints, RequestedStats};

use super::candidates::{item_potential_without_mods, target_priority};
use super::search::{CombinationEvaluator, SelectionState};

const CAP_PRIORITY_WEIGHT: i32 = 64;

/// Walks each unordered five-roll multiset exactly once.
pub(super) fn search_planning_rolls<E: CombinationEvaluator>(
    items: &[Item],
    constraints: &Constraints,
    requested_stats: Option<RequestedStats>,
    evaluator: &mut E,
) {
    let traversal = PlanningTraversal::new(items, constraints, requested_stats);
    let mut state = SelectionState::new(constraints.stat_bonuses);

    traversal.search(evaluator, &mut state, 0, 0);
}

struct PlanningTraversal<'a> {
    items: &'a [Item],
    constraints: &'a Constraints,
    ordered_rolls: Box<[usize]>,
    suffix_maximum: Box<[StatValues]>,
}

impl<'a> PlanningTraversal<'a> {
    fn new(
        items: &'a [Item],
        constraints: &'a Constraints,
        requested_stats: Option<RequestedStats>,
    ) -> Self {
        let mut ordered_rolls = (0..items.len()).collect::<Vec<_>>();
        ordered_rolls.sort_by(|left, right| {
            planning_priority(&items[*right], constraints, requested_stats)
                .cmp(&planning_priority(
                    &items[*left],
                    constraints,
                    requested_stats,
                ))
                .then_with(|| items[*left].stable_id.cmp(&items[*right].stable_id))
        });
        let suffix_maximum = build_suffix_maximum(items, constraints, &ordered_rolls);

        Self {
            items,
            constraints,
            ordered_rolls: ordered_rolls.into_boxed_slice(),
            suffix_maximum,
        }
    }

    fn search<E: CombinationEvaluator>(
        &self,
        evaluator: &mut E,
        state: &mut SelectionState,
        depth: usize,
        first_roll: usize,
    ) {
        if evaluator.should_stop() {
            return;
        }

        let remaining_pieces = SLOT_COUNT - depth;
        let remaining_potential = self.remaining_potential(first_roll, remaining_pieces);
        if !evaluator.can_continue(&state.selected_potential, &remaining_potential) {
            evaluator.prune(multiset_count(
                self.ordered_rolls.len().saturating_sub(first_roll),
                remaining_pieces,
            ));
            return;
        }

        if depth == SLOT_COUNT {
            evaluator.evaluate(&state.selected, state.base_stats);
            return;
        }

        for roll_position in first_roll..self.ordered_rolls.len() {
            let item_index = self.ordered_rolls[roll_position];
            let item = &self.items[item_index];
            let base_stats = item.base_stats;
            let potential = item_potential_without_mods(item, self.constraints);

            state.select(depth, item_index, base_stats, potential);
            self.search(evaluator, state, depth + 1, roll_position);
            state.deselect(base_stats, potential);

            if evaluator.should_stop() {
                return;
            }
        }
    }

    fn remaining_potential(&self, first_roll: usize, remaining_pieces: usize) -> StatValues {
        let Some(maximum) = self.suffix_maximum.get(first_roll) else {
            return StatValues::ZERO;
        };
        let multiplier = i16::try_from(remaining_pieces).unwrap_or(i16::MAX);
        let mut potential = StatValues::ZERO;

        for stat in Stat::ALL {
            potential[stat] = maximum[stat].saturating_mul(multiplier);
        }

        potential
    }
}

fn planning_priority(
    item: &Item,
    constraints: &Constraints,
    requested_stats: Option<RequestedStats>,
) -> i32 {
    let cap_priority = requested_stats.map_or(0, |requested| {
        let potential = item_potential_without_mods(item, constraints);

        Stat::ALL
            .into_iter()
            .filter(|stat| requested.contains(*stat))
            .map(|stat| i32::from(potential[stat]) * CAP_PRIORITY_WEIGHT)
            .sum()
    });

    target_priority(item, constraints) + cap_priority
}

fn build_suffix_maximum(
    items: &[Item],
    constraints: &Constraints,
    ordered_rolls: &[usize],
) -> Box<[StatValues]> {
    let mut suffix = vec![StatValues::ZERO; ordered_rolls.len() + 1];

    for position in (0..ordered_rolls.len()).rev() {
        suffix[position] = suffix[position + 1];
        let potential = item_potential_without_mods(&items[ordered_rolls[position]], constraints);

        for stat in Stat::ALL {
            suffix[position][stat] = suffix[position][stat].max(potential[stat]);
        }
    }

    suffix.into_boxed_slice()
}

fn multiset_count(option_count: usize, pick_count: usize) -> u64 {
    if pick_count == 0 {
        return 1;
    }

    if option_count == 0 {
        return 0;
    }

    let total = option_count + pick_count - 1;
    let chosen = pick_count.min(total - pick_count);
    let mut result = 1_u128;

    for step in 1..=chosen {
        let numerator = u128::try_from(total - chosen + step).unwrap_or(u128::MAX);
        let denominator = u128::try_from(step).unwrap_or(1);
        result = result.saturating_mul(numerator) / denominator;
    }

    u64::try_from(result).unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use super::multiset_count;

    #[test]
    fn counts_unique_roll_multisets() {
        assert_eq!(multiset_count(48, 5), 2_598_960);
        assert_eq!(multiset_count(3, 2), 6);
        assert_eq!(multiset_count(0, 2), 0);
    }
}
