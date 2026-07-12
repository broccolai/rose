//! Validated, compact armor data retained by the engine.

mod adjustment;
mod compiler;

use crate::domain::{
    ArmorSlot, CharacterClass, ClassCompatibility, Stat, StatValues, TUNING_POINTS,
};
use crate::model::STAT_COUNT;

const BALANCED_SIGNATURE_OFFSET: usize = 32;
const PAIR_CHOICES_PER_STAT: usize = STAT_COUNT - 1;

#[derive(Clone, Copy, Debug)]
pub(crate) struct PairTuning {
    pub source_index: i16,
    pub positive: Stat,
    pub negative: Stat,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct BalancedTuning {
    pub source_index: i16,
    pub deltas: StatValues,
}

#[derive(Clone, Debug)]
pub(crate) struct StatModOptions {
    minor: [Option<i16>; STAT_COUNT],
    major: [i16; STAT_COUNT],
}

impl StatModOptions {
    pub fn minor(&self, stat: Stat) -> Option<i16> {
        self.minor[stat.index()]
    }

    pub fn major(&self, stat: Stat) -> i16 {
        self.major[stat.index()]
    }
}

#[derive(Clone, Debug)]
pub(crate) struct TuningOptions {
    pair_choices: Box<[PairTuning]>,
    balanced_choice: Option<BalancedTuning>,
    signature: TuningSignature,
}

impl TuningOptions {
    pub fn new(pair_choices: Box<[PairTuning]>, balanced_choice: Option<BalancedTuning>) -> Self {
        Self {
            signature: TuningSignature::from_options(&pair_choices, balanced_choice),
            pair_choices,
            balanced_choice,
        }
    }

    pub fn pair_choices(&self) -> &[PairTuning] {
        &self.pair_choices
    }

    pub fn balanced_choice(&self) -> Option<BalancedTuning> {
        self.balanced_choice
    }

    pub fn signature(&self) -> u64 {
        self.signature.value()
    }

    pub fn pair_index(&self, positive: Stat, negative: Stat) -> Option<usize> {
        self.signature.pair_index(positive, negative)
    }
}

#[derive(Clone, Copy, Debug)]
struct TuningSignature(u64);

impl TuningSignature {
    fn from_options(pair_choices: &[PairTuning], balanced_choice: Option<BalancedTuning>) -> Self {
        let pair_bits = pair_choices.iter().fold(0_u64, |bits, choice| {
            bits | (1_u64 << adjustment::pair_code(choice.positive, choice.negative))
        });
        let balanced_bits = balanced_choice.map_or(0, |choice| {
            Stat::ALL
                .into_iter()
                .filter(|stat| choice.deltas[*stat] == 1)
                .fold(0_u64, |bits, stat| {
                    bits | (1_u64 << (stat.index() + BALANCED_SIGNATURE_OFFSET))
                })
        });

        Self(pair_bits | balanced_bits)
    }

    const fn value(self) -> u64 {
        self.0
    }

    fn pair_index(self, positive: Stat, negative: Stat) -> Option<usize> {
        if positive == negative {
            return None;
        }

        let choice_bit = Self::pair_bit(positive, negative);
        if !self.contains_pair(positive, negative) {
            return None;
        }

        usize::try_from((self.0 & (choice_bit - 1)).count_ones()).ok()
    }

    fn contains_pair(self, positive: Stat, negative: Stat) -> bool {
        positive != negative && self.0 & Self::pair_bit(positive, negative) != 0
    }

    fn has_positive_pair(self, positive: Stat) -> bool {
        let first_bit = positive.index() * PAIR_CHOICES_PER_STAT;
        let mask = ((1_u64 << PAIR_CHOICES_PER_STAT) - 1) << first_bit;

        self.0 & mask != 0
    }

    fn pair_bit(positive: Stat, negative: Stat) -> u64 {
        1_u64 << adjustment::pair_code(positive, negative)
    }
}

#[derive(Clone, Debug)]
pub(crate) struct Item {
    pub source_index: u32,
    pub stable_id: Box<str>,
    pub hash: u32,
    pub slot: ArmorSlot,
    pub class: ClassCompatibility,
    pub is_exotic: bool,
    pub exotic_variant_id: Option<u32>,
    pub set_id: Option<u32>,
    pub base_stats: StatValues,
    pub stat_mods: StatModOptions,
    pub tunings: TuningOptions,
}

impl Item {
    pub fn compatible_with(&self, class: CharacterClass) -> bool {
        self.class.supports(class)
    }

    pub fn max_tuning_gain(
        &self,
        stat: Stat,
        dump_stat: Option<Stat>,
        allow_balanced: bool,
    ) -> i16 {
        let has_pair_gain = match dump_stat {
            Some(dump_stat) if !allow_balanced => {
                self.tunings.signature.contains_pair(stat, dump_stat)
            }
            None | Some(_) => self.tunings.signature.has_positive_pair(stat),
        };
        let pair_gain = if has_pair_gain { TUNING_POINTS } else { 0 };
        let balanced_gain = if allow_balanced {
            self.tunings
                .balanced_choice()
                .map_or(0, |choice| choice.deltas[stat])
        } else {
            0
        };
        pair_gain.max(balanced_gain).max(0)
    }
}
