//! Exact tuning strategy for balanced choices or penalties across multiple stats.

use crate::domain::{Stat, StatValues, TUNING_POINTS};
use crate::model::{MAX_STAT, NO_CHOICE, SLOT_COUNT};
use crate::request::RequestedStats;

use super::pair_transfer::PairTransferSearch;
use super::plan::{apply_mod_counts, compare_plans};
use super::tuning::{AppliedTunings, TuningChoice, TuningChoices, TuningDecision};
use super::{AdjustmentPlan, AdjustmentProblem};

pub(super) fn solve_unrestricted(problem: AdjustmentProblem<'_>) -> Option<AdjustmentPlan> {
    balanced_tuning_masks(problem)
        .filter_map(|mask| solve_tuning_variant(problem, mask))
        .max_by(compare_plans)
}

fn solve_tuning_variant(
    problem: AdjustmentProblem<'_>,
    balanced_mask: BalancedMask,
) -> Option<AdjustmentPlan> {
    let balanced = apply_balanced_mask(problem, balanced_mask)?;
    let transfer_search = PairTransferSearch::for_problem(problem, balanced_mask.pair_slot_count());
    let transfer = transfer_search.complete(balanced.stats, balanced.choices)?;
    let tunings = materialize_tunings(problem, transfer.tuning_choices)?;
    let mods = apply_mod_counts(problem, tunings.stats, transfer.mod_counts)?;

    Some(AdjustmentPlan::from_applications(problem, mods, tunings))
}

pub(super) fn update_unrestricted_caps(
    caps: &mut StatValues,
    requested: RequestedStats,
    problem: AdjustmentProblem<'_>,
) {
    for score_stat in Stat::ALL {
        if !requested.contains(score_stat)
            || problem.dump_stat == Some(score_stat)
            || caps[score_stat] >= MAX_STAT
        {
            continue;
        }

        caps[score_stat] = maximize_stat(problem, score_stat, caps[score_stat]);
    }
}

fn maximize_stat(problem: AdjustmentProblem<'_>, score_stat: Stat, current_cap: i16) -> i16 {
    let mut low = current_cap;
    let mut high = MAX_STAT;
    let mut targets = problem.targets;

    while low < high {
        let candidate = low + (high - low + 1) / 2;
        targets[score_stat] = candidate;

        if solve_unrestricted(problem.with_targets(targets)).is_some() {
            low = candidate;
        } else {
            high = candidate - 1;
        }
    }

    low
}

fn balanced_tuning_masks(problem: AdjustmentProblem<'_>) -> impl Iterator<Item = BalancedMask> {
    let limit = if problem.allow_balanced_tuning {
        1_u8 << SLOT_COUNT
    } else {
        1
    };

    (0..limit).map(BalancedMask)
}

#[derive(Clone, Copy)]
struct BalancedMask(u8);

impl BalancedMask {
    fn includes(self, slot: usize) -> bool {
        self.0 & (1 << slot) != 0
    }

    fn pair_slot_count(self) -> usize {
        (0..SLOT_COUNT).filter(|slot| !self.includes(*slot)).count()
    }
}

struct BalancedSelection {
    stats: StatValues,
    choices: TuningChoices,
}

fn apply_balanced_mask(
    problem: AdjustmentProblem<'_>,
    balanced_mask: BalancedMask,
) -> Option<BalancedSelection> {
    let mut stats = problem.base_stats;
    let mut choices = TuningChoices::NONE;

    for slot in 0..SLOT_COUNT {
        if !balanced_mask.includes(slot) {
            continue;
        }

        let balanced = problem.armor.item(slot).tunings.balanced_choice()?;
        stats += &balanced.deltas;
        choices[slot] = TuningChoice::BALANCED;
    }

    Some(BalancedSelection { stats, choices })
}

fn materialize_tunings(
    problem: AdjustmentProblem<'_>,
    choices: TuningChoices,
) -> Option<AppliedTunings> {
    let mut stats = problem.base_stats;
    let mut source_indices = [NO_CHOICE; SLOT_COUNT];
    let mut used_count = 0;

    for slot in 0..SLOT_COUNT {
        let item = problem.armor.item(slot);

        match choices[slot].decision() {
            TuningDecision::Balanced => {
                let balanced = item.tunings.balanced_choice()?;
                stats += &balanced.deltas;
                source_indices[slot] = balanced.source_index;
                used_count += 1;
            }
            TuningDecision::Pair(choice_index) => {
                let tuning = item.tunings.pair_choices()[choice_index];
                stats[tuning.positive] += TUNING_POINTS;
                stats[tuning.negative] -= TUNING_POINTS;
                source_indices[slot] = tuning.source_index;
                used_count += 1;
            }
            TuningDecision::None => {}
        }
    }

    Some(AppliedTunings::new(stats, source_indices, used_count))
}
