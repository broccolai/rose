//! Matches required stat transfers to legal tuning choices on the selected armor.

use crate::domain::{Stat, StatMap, StatValues, TUNING_POINTS, minimum_tuning_steps};
use crate::model::SLOT_COUNT;

use crate::adjustments::tuning::{TuningChoice, TuningChoices};

use super::PairTransferSearch;

struct TransferNeeds {
    deficits: StatMap<usize>,
    sources: StatMap<usize>,
    required_count: usize,
}

impl TransferNeeds {
    fn can_fit(&self, available_slots: usize) -> bool {
        self.required_count <= available_slots && self.sources_total() >= self.required_count
    }

    fn sources_total(&self) -> usize {
        Stat::ALL.into_iter().map(|stat| self.sources[stat]).sum()
    }

    fn take(&mut self, destination: Stat, source: Stat) {
        self.deficits[destination] -= 1;
        self.sources[source] -= 1;
    }

    fn restore(&mut self, destination: Stat, source: Stat) {
        self.sources[source] += 1;
        self.deficits[destination] += 1;
    }
}

impl PairTransferSearch<'_> {
    pub(super) fn assign_tunings(
        &self,
        stats: StatValues,
        tuning_choices: &mut TuningChoices,
    ) -> bool {
        let mut needs = self.transfer_needs(stats);

        needs.can_fit(self.pair_slot_count) && self.assign_required(&mut needs, tuning_choices)
    }

    fn transfer_needs(&self, stats: StatValues) -> TransferNeeds {
        let mut deficits = StatMap::filled(0);
        let mut sources = StatMap::filled(0);
        let mut required_count = 0;

        for stat in Stat::ALL {
            if self.dump_stat == Some(stat) {
                sources[stat] = SLOT_COUNT;
                continue;
            }

            deficits[stat] = minimum_tuning_steps(stats[stat], self.targets[stat]);
            required_count += deficits[stat];

            let surplus = (i32::from(stats[stat]) - i32::from(self.targets[stat])).max(0);
            let surplus = usize::try_from(surplus).unwrap_or_default();
            sources[stat] = (surplus / usize::from(TUNING_POINTS.unsigned_abs())).min(SLOT_COUNT);
        }

        TransferNeeds {
            deficits,
            sources,
            required_count,
        }
    }

    fn assign_required(
        &self,
        needs: &mut TransferNeeds,
        tuning_choices: &mut TuningChoices,
    ) -> bool {
        let Some(destination) = self.most_constrained_destination(needs, tuning_choices) else {
            return true;
        };

        for slot in 0..SLOT_COUNT {
            if !tuning_choices[slot].is_none() {
                continue;
            }

            let tunings = &self.armor.item(slot).tunings;
            for source in Stat::ALL {
                if needs.sources[source] == 0 {
                    continue;
                }

                let Some(choice_index) = tunings.pair_index(destination, source) else {
                    continue;
                };

                let Some(tuning_choice) = TuningChoice::pair(choice_index) else {
                    continue;
                };

                tuning_choices[slot] = tuning_choice;
                needs.take(destination, source);

                if self.assign_required(needs, tuning_choices) {
                    return true;
                }

                needs.restore(destination, source);
                tuning_choices[slot] = TuningChoice::NONE;
            }
        }

        false
    }

    fn most_constrained_destination(
        &self,
        needs: &TransferNeeds,
        tuning_choices: &TuningChoices,
    ) -> Option<Stat> {
        Stat::ALL
            .into_iter()
            .filter(|destination| needs.deficits[*destination] > 0)
            .min_by_key(|destination| self.available_choices(*destination, needs, tuning_choices))
    }

    fn available_choices(
        &self,
        destination: Stat,
        needs: &TransferNeeds,
        tuning_choices: &TuningChoices,
    ) -> usize {
        tuning_choices
            .iter()
            .enumerate()
            .filter(|(_, choice)| choice.is_none())
            .map(|(slot, _)| {
                let tunings = &self.armor.item(slot).tunings;
                Stat::ALL
                    .into_iter()
                    .filter(|source| {
                        needs.sources[*source] > 0
                            && tunings.pair_index(destination, *source).is_some()
                    })
                    .count()
            })
            .sum()
    }
}
