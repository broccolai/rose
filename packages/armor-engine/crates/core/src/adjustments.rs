//! Coordinates stat mods and tuning after an armor combination is selected.

mod cache;
mod mods;
mod pair_transfer;
mod plan;
mod restricted;
mod tuning;
mod unrestricted;

use crate::domain::{Stat, StatValues};
use crate::item::Item;
use crate::model::{MAX_STAT, SLOT_COUNT};
use crate::request::{Constraints, RequestedStats};

pub(crate) use self::cache::AllocationCache;
pub(crate) use self::plan::AdjustmentPlan;
use self::restricted::{solve_restricted, update_restricted_caps};
use self::unrestricted::{solve_unrestricted, update_unrestricted_caps};

#[derive(Clone, Copy)]
pub(crate) struct AdjustmentProblem<'a> {
    armor: SelectedArmor<'a>,
    base_stats: StatValues,
    targets: StatValues,
    dump_stat: Option<Stat>,
    allow_balanced_tuning: bool,
}

impl<'a> AdjustmentProblem<'a> {
    pub(crate) fn from_constraints(
        items: &'a [Item],
        selected: &'a [usize; SLOT_COUNT],
        base_stats: StatValues,
        constraints: &Constraints,
    ) -> Self {
        Self {
            armor: SelectedArmor { items, selected },
            base_stats,
            targets: constraints.targets,
            dump_stat: constraints.dump_stat,
            allow_balanced_tuning: constraints.allow_balanced_tuning,
        }
    }

    fn with_targets(self, targets: StatValues) -> Self {
        Self { targets, ..self }
    }

    fn meets_targets(self, stats: StatValues) -> bool {
        Stat::ALL.into_iter().all(|stat| {
            self.dump_stat == Some(stat) || stats[stat].clamp(0, MAX_STAT) >= self.targets[stat]
        })
    }

    fn tuning_strategy(self) -> TuningStrategy {
        if !self.allow_balanced_tuning
            && let Some(dump_stat) = self.dump_stat
        {
            return TuningStrategy::RestrictedTo(dump_stat);
        }

        TuningStrategy::Unrestricted
    }
}

#[derive(Clone, Copy)]
struct SelectedArmor<'a> {
    items: &'a [Item],
    selected: &'a [usize; SLOT_COUNT],
}

#[derive(Clone, Copy)]
enum TuningStrategy {
    RestrictedTo(Stat),
    Unrestricted,
}

impl<'a> SelectedArmor<'a> {
    fn item(self, slot: usize) -> &'a Item {
        &self.items[self.selected[slot]]
    }

    fn tuning_signatures(self) -> [u64; SLOT_COUNT] {
        std::array::from_fn(|slot| self.item(slot).tunings.signature())
    }
}

pub(crate) fn solve_adjustments(
    problem: AdjustmentProblem<'_>,
    cache: &mut AllocationCache,
) -> Option<AdjustmentPlan> {
    match problem.tuning_strategy() {
        TuningStrategy::RestrictedTo(dump_stat) => solve_restricted(problem, dump_stat, cache),
        TuningStrategy::Unrestricted => solve_unrestricted(problem),
    }
}

pub(crate) fn update_adjustment_caps(
    caps: &mut StatValues,
    requested: RequestedStats,
    problem: AdjustmentProblem<'_>,
    cache: &mut AllocationCache,
) {
    match problem.tuning_strategy() {
        TuningStrategy::RestrictedTo(dump_stat) => {
            update_restricted_caps(caps, requested, problem, dump_stat, cache);
        }
        TuningStrategy::Unrestricted => update_unrestricted_caps(caps, requested, problem),
    }
}
