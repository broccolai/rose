//! Fast tuning strategy where every penalty is assigned to the selected dump stat.

use crate::domain::{MajorModRequirements, Stat, StatValues, remaining_major_mod_bonus};
use crate::model::{MAX_STAT, NO_CHOICE, SLOT_COUNT};
use crate::request::RequestedStats;

use super::cache::{AllocationCache, TuningAllocation};
use super::plan::{apply_required_mods, compare_plans};
use super::tuning::AppliedTunings;
use super::{AdjustmentPlan, AdjustmentProblem, SelectedArmor};

pub(super) fn solve_restricted(
    problem: AdjustmentProblem<'_>,
    dump_stat: Stat,
    cache: &mut AllocationCache,
) -> Option<AdjustmentPlan> {
    cache
        .restricted_allocations(problem.armor, dump_stat)
        .iter()
        .filter_map(|allocation| solve_allocation(problem, allocation))
        .max_by(compare_plans)
}

fn solve_allocation(
    problem: AdjustmentProblem<'_>,
    allocation: &TuningAllocation,
) -> Option<AdjustmentPlan> {
    let tunings = AppliedTunings::from_deltas(
        problem.base_stats,
        &allocation.deltas,
        materialize_tuning_indices(problem.armor, allocation),
        allocation.used_tunings,
    );
    let mods = apply_required_mods(problem, tunings.stats)?;

    Some(AdjustmentPlan::from_applications(problem, mods, tunings))
}

pub(super) fn update_restricted_caps(
    caps: &mut StatValues,
    requested: RequestedStats,
    problem: AdjustmentProblem<'_>,
    dump_stat: Stat,
    cache: &mut AllocationCache,
) {
    let allocations = cache.restricted_allocations(problem.armor, dump_stat);

    for allocation in allocations {
        let mut stats = problem.base_stats;
        stats += &allocation.deltas;
        let required_mods =
            MajorModRequirements::from_stats(&stats, &problem.targets, Some(dump_stat));

        for score_stat in Stat::ALL {
            if !requested.contains(score_stat)
                || score_stat == dump_stat
                || caps[score_stat] >= MAX_STAT
            {
                continue;
            }

            let Some(remaining_mod_points) =
                remaining_major_mod_bonus(required_mods.excluding(score_stat))
            else {
                continue;
            };

            let candidate = (stats[score_stat] + remaining_mod_points).clamp(0, MAX_STAT);
            caps[score_stat] = caps[score_stat].max(candidate);
        }
    }
}

fn materialize_tuning_indices(
    armor: SelectedArmor<'_>,
    allocation: &TuningAllocation,
) -> [i16; SLOT_COUNT] {
    let mut source_indices = [NO_CHOICE; SLOT_COUNT];

    for (slot, choice) in allocation.choices.iter().copied().enumerate() {
        if let Some(index) = choice.pair_index() {
            source_indices[slot] = armor.item(slot).tunings.pair_choices()[index].source_index;
        }
    }

    source_indices
}
