//! Assigns +5/-5 tuning choices as transfers between six stat buckets.

mod matching;

use crate::domain::{MAJOR_MOD_POINTS, Stat, StatMap, StatValues, minimum_tuning_steps};
use crate::model::{SLOT_COUNT, STAT_COUNT};

use super::mods::ModCounts;
use super::tuning::TuningChoices;
use super::{AdjustmentProblem, SelectedArmor};

pub(super) struct TransferSolution {
    pub mod_counts: ModCounts,
    pub tuning_choices: TuningChoices,
}

pub(super) struct PairTransferSearch<'a> {
    armor: SelectedArmor<'a>,
    targets: StatValues,
    dump_stat: Option<Stat>,
    pair_slot_count: usize,
}

impl<'a> PairTransferSearch<'a> {
    pub fn for_problem(problem: AdjustmentProblem<'a>, pair_slot_count: usize) -> Self {
        Self {
            armor: problem.armor,
            targets: problem.targets,
            dump_stat: problem.dump_stat,
            pair_slot_count,
        }
    }

    pub fn complete(
        &self,
        base_stats: StatValues,
        tuning_choices: TuningChoices,
    ) -> Option<TransferSolution> {
        // Reserve unavoidable +10 mods first, then backtrack only over the
        // remaining mod counts and legal five-point transfers.
        let destination_capacity = self.destination_capacity(&tuning_choices);
        let state = self.reserve_mandatory_mods(base_stats, &destination_capacity)?;

        self.search_additional_mods(state, tuning_choices, 0)
    }

    fn reserve_mandatory_mods(
        &self,
        mut stats: StatValues,
        destination_capacity: &StatMap<usize>,
    ) -> Option<ModSearchState> {
        let mut counts = ModCounts::ZERO;

        for stat in Stat::ALL {
            if self.dump_stat == Some(stat) {
                continue;
            }

            let deficit_steps = minimum_tuning_steps(stats[stat], self.targets[stat]);
            let available_tunings = self.pair_slot_count.min(destination_capacity[stat]);
            let mandatory_mods = deficit_steps.saturating_sub(available_tunings).div_ceil(2);
            counts[stat] = u8::try_from(mandatory_mods).ok()?;
            stats[stat] += i16::from(counts[stat]) * MAJOR_MOD_POINTS;
        }

        (counts.total() <= SLOT_COUNT).then_some(ModSearchState { stats, counts })
    }

    fn search_additional_mods(
        &self,
        state: ModSearchState,
        mut tuning_choices: TuningChoices,
        first_stat_index: usize,
    ) -> Option<TransferSolution> {
        tuning_choices.clear_pairs();

        if self.assign_tunings(state.stats, &mut tuning_choices) {
            return Some(TransferSolution {
                mod_counts: state.counts,
                tuning_choices,
            });
        }

        if state.counts.total() >= SLOT_COUNT {
            return None;
        }

        for stat_index in first_stat_index..STAT_COUNT {
            let stat = Stat::ALL[stat_index];
            if self.dump_stat == Some(stat) || state.stats[stat] >= self.targets[stat] {
                continue;
            }

            if let Some(solution) =
                self.search_additional_mods(state.with_major_mod(stat), tuning_choices, stat_index)
            {
                return Some(solution);
            }
        }

        None
    }

    fn destination_capacity(&self, tuning_choices: &TuningChoices) -> StatMap<usize> {
        let mut capacity = StatMap::filled(0);

        for (slot, tuning_choice) in tuning_choices.iter().enumerate() {
            if !tuning_choice.is_none() {
                continue;
            }

            let mut destinations = 0_u8;
            for choice in self.armor.item(slot).tunings.pair_choices() {
                destinations |= 1 << choice.positive.index();
            }

            for stat in Stat::ALL {
                capacity[stat] += usize::from(destinations & (1 << stat.index()) != 0);
            }
        }

        capacity
    }
}

#[derive(Clone, Copy)]
struct ModSearchState {
    stats: StatValues,
    counts: ModCounts,
}

impl ModSearchState {
    fn with_major_mod(mut self, stat: Stat) -> Self {
        self.stats[stat] += MAJOR_MOD_POINTS;
        self.counts.increment(stat);
        self
    }
}
