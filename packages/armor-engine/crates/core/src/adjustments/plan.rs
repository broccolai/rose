use std::cmp::{Ordering, Reverse};

use crate::domain::{MAJOR_MOD_POINTS, MINOR_MOD_POINTS, MajorModRequirements, Stat, StatValues};
use crate::item::Item;
use crate::model::{MAX_STAT, NO_CHOICE, SLOT_COUNT};

use super::AdjustmentProblem;
use super::mods::ModCounts;
use super::tuning::AppliedTunings;

type ChoiceIndexes = ([i16; SLOT_COUNT], [i16; SLOT_COUNT]);
type PlanRank = (i16, u8, Reverse<i16>, Reverse<ChoiceIndexes>);

#[derive(Clone, Debug)]
pub(crate) struct AdjustmentPlan {
    pub stats: StatValues,
    pub stat_mod_indices: [i16; SLOT_COUNT],
    pub tuning_indices: [i16; SLOT_COUNT],
    pub wasted_stats: i16,
    pub total_stats: i16,
    used_tunings: u8,
}

impl AdjustmentPlan {
    pub(super) fn from_applications(
        problem: AdjustmentProblem<'_>,
        mods: AppliedMods,
        tunings: AppliedTunings,
    ) -> Self {
        let stats = mods.stats.clamped();
        let wasted_stats = Stat::ALL
            .into_iter()
            .filter(|stat| problem.dump_stat != Some(*stat))
            .map(|stat| (stats[stat] - problem.targets[stat]).max(0))
            .sum();

        Self {
            stats,
            stat_mod_indices: mods.source_indices,
            tuning_indices: tunings.source_indices,
            wasted_stats,
            total_stats: stats.total(),
            used_tunings: tunings.used_count,
        }
    }

    fn rank(&self) -> PlanRank {
        (
            self.total_stats,
            self.used_tunings,
            Reverse(self.wasted_stats),
            Reverse((self.stat_mod_indices, self.tuning_indices)),
        )
    }
}

#[derive(Clone, Copy, Debug)]
pub(super) struct AppliedMods {
    pub stats: StatValues,
    pub source_indices: [i16; SLOT_COUNT],
}

pub(super) fn compare_plans(left: &AdjustmentPlan, right: &AdjustmentPlan) -> Ordering {
    left.rank().cmp(&right.rank())
}

pub(super) fn apply_required_mods(
    problem: AdjustmentProblem<'_>,
    stats: StatValues,
) -> Option<AppliedMods> {
    let mut counts = ModCounts::ZERO;
    let required = MajorModRequirements::from_stats(&stats, &problem.targets, problem.dump_stat);

    for stat in Stat::ALL {
        counts[stat] = u8::try_from(required.for_stat(stat)).ok()?;
    }

    apply_mod_counts(problem, stats, counts)
}

pub(super) fn apply_mod_counts(
    problem: AdjustmentProblem<'_>,
    mut stats: StatValues,
    counts: ModCounts,
) -> Option<AppliedMods> {
    if counts.total() > SLOT_COUNT {
        return None;
    }

    let mut source_indices = [NO_CHOICE; SLOT_COUNT];
    let mut slot = 0;

    for stat in Stat::ALL {
        for _ in 0..counts[stat] {
            let choice = select_stat_mod(
                problem.armor.item(slot),
                stat,
                stats[stat],
                problem.targets[stat],
            );
            source_indices[slot] = choice.source_index;
            stats[stat] += choice.points;
            slot += 1;
        }
    }

    problem.meets_targets(stats).then_some(AppliedMods {
        stats,
        source_indices,
    })
}

#[derive(Clone, Copy)]
struct StatModChoice {
    points: i16,
    source_index: i16,
}

fn select_stat_mod(item: &Item, stat: Stat, current: i16, target: i16) -> StatModChoice {
    if current + MAJOR_MOD_POINTS > MAX_STAT
        && current + MINOR_MOD_POINTS >= target
        && let Some(source_index) = item.stat_mods.minor(stat)
    {
        return StatModChoice {
            points: MINOR_MOD_POINTS,
            source_index,
        };
    }

    StatModChoice {
        points: MAJOR_MOD_POINTS,
        source_index: item.stat_mods.major(stat),
    }
}
