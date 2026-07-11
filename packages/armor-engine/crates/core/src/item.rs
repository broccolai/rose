use crate::model::{AdjustmentInput, EngineError, ItemInput, SLOT_COUNT, STAT_COUNT, Stats};

pub(crate) const ANY_CLASS: u8 = 3;

#[derive(Clone, Copy, Debug)]
pub(crate) struct PairTuning {
    pub source_index: i16,
    pub positive: u8,
    pub negative: u8,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct BalancedTuning {
    pub source_index: i16,
    pub deltas: Stats,
}

#[derive(Clone, Debug)]
pub(crate) struct Item {
    pub source_index: u32,
    pub stable_id: Box<str>,
    pub item_hash: u32,
    pub slot: u8,
    pub class_type: u8,
    pub is_exotic: bool,
    pub set_id: Option<u32>,
    pub base_stats: Stats,
    pub minor_mods: [Option<i16>; STAT_COUNT],
    pub major_mods: [i16; STAT_COUNT],
    pub pair_tunings: Box<[PairTuning]>,
    pub balanced_tuning: Option<BalancedTuning>,
    pub tuning_signature: u64,
}

impl Item {
    pub fn compile(input: ItemInput) -> Result<Self, EngineError> {
        if usize::from(input.slot) >= SLOT_COUNT {
            return Err(EngineError(format!(
                "Item {} has invalid slot {}.",
                input.stable_id, input.slot
            )));
        }
        if input.class_type > ANY_CLASS {
            return Err(EngineError(format!(
                "Item {} has invalid class type {}.",
                input.stable_id, input.class_type
            )));
        }

        let mut minor_mods = [None; STAT_COUNT];
        let mut major_mods = [None; STAT_COUNT];
        let mut has_no_mod = false;
        for adjustment in &input.stat_mods {
            match classify_stat_mod(adjustment) {
                StatModKind::None => has_no_mod = true,
                StatModKind::Minor(stat) => {
                    minor_mods[stat] = Some(adjustment_index(adjustment, &input.stable_id)?);
                }
                StatModKind::Major(stat) => {
                    major_mods[stat] = Some(adjustment_index(adjustment, &input.stable_id)?);
                }
                StatModKind::Invalid => {
                    return Err(EngineError(format!(
                        "Item {} contains a non-standard modern stat mod.",
                        input.stable_id
                    )));
                }
            }
        }
        if !has_no_mod || major_mods.contains(&None) {
            return Err(EngineError(format!(
                "Item {} does not expose the complete modern +10 stat-mod set.",
                input.stable_id
            )));
        }
        let major_mods =
            major_mods.map(|source_index| source_index.expect("validated major stat mods"));

        let mut has_no_tuning = false;
        let mut pair_by_code: [Option<PairTuning>; 30] = [None; 30];
        let mut balanced_tuning = None;
        for adjustment in &input.tunings {
            match classify_tuning(adjustment) {
                TuningKind::None => has_no_tuning = true,
                TuningKind::Pair { positive, negative } => {
                    let code = pair_code(positive, negative);
                    pair_by_code[code].get_or_insert(PairTuning {
                        source_index: adjustment_index(adjustment, &input.stable_id)?,
                        positive: positive as u8,
                        negative: negative as u8,
                    });
                }
                TuningKind::Balanced => {
                    balanced_tuning.get_or_insert(BalancedTuning {
                        source_index: adjustment_index(adjustment, &input.stable_id)?,
                        deltas: adjustment.deltas,
                    });
                }
                TuningKind::Invalid => {
                    return Err(EngineError(format!(
                        "Item {} contains a non-standard modern tuning option.",
                        input.stable_id
                    )));
                }
            }
        }
        if !has_no_tuning {
            return Err(EngineError(format!(
                "Item {} is missing the no-tuning option.",
                input.stable_id
            )));
        }

        let pair_tunings = pair_by_code
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .into_boxed_slice();
        let mut tuning_signature = 0_u64;
        for tuning in &pair_tunings {
            tuning_signature |=
                1_u64 << pair_code(usize::from(tuning.positive), usize::from(tuning.negative));
        }
        if let Some(balanced) = balanced_tuning {
            let mut mask = 0_u64;
            for (index, delta) in balanced.deltas.iter().enumerate() {
                if *delta == 1 {
                    mask |= 1_u64 << index;
                }
            }
            tuning_signature |= mask << 32;
        }

        Ok(Self {
            source_index: input.source_index,
            stable_id: input.stable_id.into_boxed_str(),
            item_hash: input.item_hash,
            slot: input.slot,
            class_type: input.class_type,
            is_exotic: input.is_exotic,
            set_id: input.set_id,
            base_stats: input.base_stats,
            minor_mods,
            major_mods,
            pair_tunings,
            balanced_tuning,
            tuning_signature,
        })
    }

    pub fn compatible_with(&self, class_type: u8) -> bool {
        self.class_type == class_type || self.class_type == ANY_CLASS
    }

    pub fn max_tuning_gain(
        &self,
        stat: usize,
        dump_stat: Option<usize>,
        allow_balanced: bool,
    ) -> i16 {
        let pair_gain = self
            .pair_tunings
            .iter()
            .filter(|choice| {
                allow_balanced || dump_stat.is_none_or(|dump| usize::from(choice.negative) == dump)
            })
            .map(|choice| {
                if usize::from(choice.positive) == stat {
                    5
                } else {
                    0
                }
            })
            .max()
            .unwrap_or(0);
        let balanced_gain = if allow_balanced {
            self.balanced_tuning.map_or(0, |choice| choice.deltas[stat])
        } else {
            0
        };
        pair_gain.max(balanced_gain).max(0)
    }
}

enum StatModKind {
    None,
    Minor(usize),
    Major(usize),
    Invalid,
}

fn adjustment_index(adjustment: &AdjustmentInput, item_id: &str) -> Result<i16, EngineError> {
    i16::try_from(adjustment.source_index).map_err(|_| {
        EngineError(format!(
            "Item {item_id} has an adjustment index that exceeds the compact result format."
        ))
    })
}

fn classify_stat_mod(adjustment: &AdjustmentInput) -> StatModKind {
    let mut changed = adjustment
        .deltas
        .iter()
        .enumerate()
        .filter(|(_, value)| **value != 0);
    let first = changed.next();
    if first.is_none() {
        return StatModKind::None;
    }
    if changed.next().is_some() {
        return StatModKind::Invalid;
    }

    let (stat, value) = first.expect("checked above");
    match *value {
        5 => StatModKind::Minor(stat),
        10 => StatModKind::Major(stat),
        _ => StatModKind::Invalid,
    }
}

enum TuningKind {
    None,
    Pair { positive: usize, negative: usize },
    Balanced,
    Invalid,
}

fn classify_tuning(adjustment: &AdjustmentInput) -> TuningKind {
    let mut positive = None;
    let mut negative = None;
    let mut positive_ones = 0;
    let mut non_zero = 0;

    for (index, value) in adjustment.deltas.iter().copied().enumerate() {
        if value != 0 {
            non_zero += 1;
        }
        if value == 5 {
            if positive.replace(index).is_some() {
                return TuningKind::Invalid;
            }
        } else if value == -5 {
            if negative.replace(index).is_some() {
                return TuningKind::Invalid;
            }
        } else if value == 1 {
            positive_ones += 1;
        } else if value != 0 {
            return TuningKind::Invalid;
        }
    }

    if non_zero == 0 {
        return TuningKind::None;
    }
    if non_zero == 2
        && let (Some(positive), Some(negative)) = (positive, negative)
    {
        return TuningKind::Pair { positive, negative };
    }
    if non_zero >= 3 && positive_ones == non_zero {
        return TuningKind::Balanced;
    }
    TuningKind::Invalid
}

pub(crate) const fn pair_code(positive: usize, negative: usize) -> usize {
    positive * (STAT_COUNT - 1) + negative - if negative > positive { 1 } else { 0 }
}
