//! Represents tuning decisions and their applied stat effects.

use std::ops::{Index, IndexMut};

use crate::domain::StatValues;
use crate::model::SLOT_COUNT;

#[derive(Clone, Copy, Debug)]
pub(super) struct AppliedTunings {
    pub(super) stats: StatValues,
    pub(super) source_indices: [i16; SLOT_COUNT],
    pub(super) used_count: u8,
}

impl AppliedTunings {
    pub(super) fn new(
        stats: StatValues,
        source_indices: [i16; SLOT_COUNT],
        used_count: u8,
    ) -> Self {
        Self {
            stats,
            source_indices,
            used_count,
        }
    }

    pub(super) fn from_deltas(
        base_stats: StatValues,
        deltas: &StatValues,
        source_indices: [i16; SLOT_COUNT],
        used_count: u8,
    ) -> Self {
        let mut stats = base_stats;
        stats += deltas;

        Self::new(stats, source_indices, used_count)
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
#[repr(transparent)]
pub(super) struct TuningChoice(i8);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum TuningDecision {
    Balanced,
    None,
    Pair(usize),
}

impl TuningChoice {
    const BALANCED_CODE: i8 = -2;
    const NONE_CODE: i8 = -1;

    pub const BALANCED: Self = Self(Self::BALANCED_CODE);
    pub const NONE: Self = Self(Self::NONE_CODE);

    pub fn pair(index: usize) -> Option<Self> {
        let code = i8::try_from(index).ok()?;
        (code >= 0).then_some(Self(code))
    }

    pub fn pair_index(self) -> Option<usize> {
        match self.decision() {
            TuningDecision::Pair(index) => Some(index),
            TuningDecision::Balanced | TuningDecision::None => None,
        }
    }

    pub const fn is_none(self) -> bool {
        self.0 == Self::NONE_CODE
    }

    pub fn decision(self) -> TuningDecision {
        match self.0 {
            Self::BALANCED_CODE => TuningDecision::Balanced,
            Self::NONE_CODE => TuningDecision::None,
            pair_index => TuningDecision::Pair(usize::from(pair_index.cast_unsigned())),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(super) struct TuningChoices([TuningChoice; SLOT_COUNT]);

impl TuningChoices {
    pub const NONE: Self = Self([TuningChoice::NONE; SLOT_COUNT]);

    pub fn iter(&self) -> impl Iterator<Item = &TuningChoice> {
        self.0.iter()
    }

    pub fn clear_pairs(&mut self) {
        for choice in &mut self.0 {
            if choice.pair_index().is_some() {
                *choice = TuningChoice::NONE;
            }
        }
    }
}

impl Index<usize> for TuningChoices {
    type Output = TuningChoice;

    fn index(&self, slot: usize) -> &Self::Output {
        &self.0[slot]
    }
}

impl IndexMut<usize> for TuningChoices {
    fn index_mut(&mut self, slot: usize) -> &mut Self::Output {
        &mut self.0[slot]
    }
}

#[cfg(test)]
mod tests {
    use std::mem::size_of;

    use crate::model::SLOT_COUNT;

    use super::TuningChoices;

    #[test]
    fn five_tuning_choices_stay_packed_to_five_bytes() {
        assert_eq!(size_of::<TuningChoices>(), SLOT_COUNT);
    }
}
