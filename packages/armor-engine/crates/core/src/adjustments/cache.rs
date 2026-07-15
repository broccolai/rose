use std::collections::hash_map::Entry;

use rustc_hash::FxHashMap;

use crate::domain::{Stat, StatValues, TUNING_POINTS};
use crate::item::{Item, PairTuning};
use crate::model::SLOT_COUNT;

use super::SelectedArmor;
use super::tuning::{TuningChoice, TuningChoices};

const MAX_PROFILE_ENTRIES: usize = 2_048;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct AllocationKey {
    signatures: [u64; SLOT_COUNT],
    dump_stat: Stat,
}

impl AllocationKey {
    fn new(armor: SelectedArmor<'_>, dump_stat: Stat) -> Self {
        Self {
            signatures: armor.tuning_signatures(),
            dump_stat,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub(super) struct TuningAllocation {
    pub deltas: StatValues,
    pub choices: TuningChoices,
    pub used_tunings: u8,
}

impl TuningAllocation {
    const NONE: Self = Self {
        deltas: StatValues::ZERO,
        choices: TuningChoices::NONE,
        used_tunings: 0,
    };

    fn with_pair(mut self, slot: usize, choice_index: usize, tuning: PairTuning) -> Option<Self> {
        self.deltas[tuning.positive] += TUNING_POINTS;
        self.deltas[tuning.negative] -= TUNING_POINTS;
        self.choices[slot] = TuningChoice::pair(choice_index)?;
        self.used_tunings += 1;

        Some(self)
    }

    fn is_preferred_to(self, current: Self) -> bool {
        self.used_tunings > current.used_tunings
            || (self.used_tunings == current.used_tunings && self.choices < current.choices)
    }
}

#[derive(Default)]
pub(crate) struct AllocationCache {
    entries: FxHashMap<AllocationKey, Box<[TuningAllocation]>>,
}

impl AllocationCache {
    pub(super) fn restricted_allocations(
        &mut self,
        armor: SelectedArmor<'_>,
        dump_stat: Stat,
    ) -> &[TuningAllocation] {
        let key = AllocationKey::new(armor, dump_stat);
        if self.entries.len() >= MAX_PROFILE_ENTRIES && !self.entries.contains_key(&key) {
            self.entries.clear();
        }

        self.entries
            .entry(key)
            .or_insert_with(|| build_allocations(armor, dump_stat))
    }
}

fn build_allocations(armor: SelectedArmor<'_>, dump_stat: Stat) -> Box<[TuningAllocation]> {
    let mut current = FxHashMap::default();
    current.insert(StatValues::ZERO, TuningAllocation::NONE);

    for slot in 0..SLOT_COUNT {
        current = extend_with_item(&current, armor.item(slot), slot, dump_stat);
    }

    let mut allocations = current.into_values().collect::<Vec<_>>();
    allocations.sort_by(|left, right| {
        left.deltas
            .cmp(&right.deltas)
            .then_with(|| left.choices.cmp(&right.choices))
    });
    allocations.into_boxed_slice()
}

fn extend_with_item(
    current: &FxHashMap<StatValues, TuningAllocation>,
    item: &Item,
    slot: usize,
    dump_stat: Stat,
) -> FxHashMap<StatValues, TuningAllocation> {
    let mut next = FxHashMap::default();

    for allocation in current.values() {
        retain_preferred(&mut next, *allocation);

        for (choice_index, choice) in item.tunings.pair_choices().iter().enumerate() {
            if choice.negative != dump_stat {
                continue;
            }

            let Some(candidate) = allocation.with_pair(slot, choice_index, *choice) else {
                continue;
            };
            retain_preferred(&mut next, candidate);
        }
    }

    next
}

fn retain_preferred(
    allocations: &mut FxHashMap<StatValues, TuningAllocation>,
    candidate: TuningAllocation,
) {
    match allocations.entry(candidate.deltas) {
        Entry::Vacant(entry) => {
            entry.insert(candidate);
        }
        Entry::Occupied(mut entry) if candidate.is_preferred_to(*entry.get()) => {
            entry.insert(candidate);
        }
        Entry::Occupied(_) => {}
    }
}
