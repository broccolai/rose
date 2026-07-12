//! Classifies normalized manifest adjustments into supported modern choices.

use crate::domain::{MAJOR_MOD_POINTS, MINOR_MOD_POINTS, Stat, TUNING_POINTS};
use crate::error::EngineError;
use crate::model::{AdjustmentInput, STAT_COUNT};

pub(super) enum StatModKind {
    None,
    Minor(Stat),
    Major(Stat),
    Invalid,
}

pub(super) fn adjustment_index(
    adjustment: &AdjustmentInput,
    item_id: &str,
) -> Result<i16, EngineError> {
    i16::try_from(adjustment.source_index).map_err(|_| EngineError::AdjustmentIndexTooLarge {
        item_id: item_id.into(),
        source_index: adjustment.source_index,
    })
}

pub(super) fn classify_stat_mod(adjustment: &AdjustmentInput) -> StatModKind {
    let mut changed = Stat::ALL
        .into_iter()
        .zip(adjustment.deltas)
        .filter(|(_, value)| *value != 0);
    let Some((stat, value)) = changed.next() else {
        return StatModKind::None;
    };
    if changed.next().is_some() {
        return StatModKind::Invalid;
    }

    match value {
        MINOR_MOD_POINTS => StatModKind::Minor(stat),
        MAJOR_MOD_POINTS => StatModKind::Major(stat),
        _ => StatModKind::Invalid,
    }
}

pub(super) enum TuningKind {
    None,
    Pair { positive: Stat, negative: Stat },
    Balanced,
    Invalid,
}

pub(super) fn classify_tuning(adjustment: &AdjustmentInput) -> TuningKind {
    let mut positive = None;
    let mut negative = None;
    let mut positive_ones = 0;
    let mut non_zero = 0;

    for (stat, value) in Stat::ALL.into_iter().zip(adjustment.deltas) {
        if value != 0 {
            non_zero += 1;
        }

        match value {
            TUNING_POINTS => {
                if positive.replace(stat).is_some() {
                    return TuningKind::Invalid;
                }
            }
            value if value == -TUNING_POINTS => {
                if negative.replace(stat).is_some() {
                    return TuningKind::Invalid;
                }
            }
            1 => positive_ones += 1,
            0 => {}
            _ => return TuningKind::Invalid,
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

pub(super) fn pair_code(positive: Stat, negative: Stat) -> usize {
    let positive = positive.index();
    let negative = negative.index();
    positive * (STAT_COUNT - 1) + negative - usize::from(negative > positive)
}
