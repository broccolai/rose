use crate::domain::{ArmorSlot, ClassCompatibility};
use crate::error::EngineError;
use crate::model::{ItemInput, STAT_COUNT};

use super::adjustment::{
    StatModKind, TuningKind, adjustment_index, classify_stat_mod, classify_tuning, pair_code,
};
use super::{BalancedTuning, Item, PairTuning, StatModOptions, TuningOptions};

const PAIR_TUNING_COMBINATIONS: usize = STAT_COUNT * (STAT_COUNT - 1);

struct ItemIdentity {
    slot: ArmorSlot,
    class: ClassCompatibility,
}

impl TryFrom<ItemInput> for Item {
    type Error = EngineError;

    fn try_from(input: ItemInput) -> Result<Self, Self::Error> {
        let identity = compile_identity(&input)?;
        let stat_mods = compile_stat_mods(&input)?;
        let tunings = compile_tunings(&input)?;

        Ok(Self {
            source_index: input.source_index,
            stable_id: input.stable_id.into_boxed_str(),
            hash: input.item_hash,
            slot: identity.slot,
            class: identity.class,
            is_exotic: input.is_exotic,
            exotic_variant_id: input.exotic_variant_id,
            set_id: input.set_id,
            base_stats: input.base_stats.into(),
            stat_mods,
            tunings,
        })
    }
}

fn compile_identity(input: &ItemInput) -> Result<ItemIdentity, EngineError> {
    let slot = ArmorSlot::try_from(input.slot).map_err(|slot| EngineError::InvalidItemSlot {
        item_id: input.stable_id.clone(),
        slot,
    })?;
    let class = ClassCompatibility::try_from(input.class_type).map_err(|class_type| {
        EngineError::InvalidItemClass {
            item_id: input.stable_id.clone(),
            class_type,
        }
    })?;

    Ok(ItemIdentity { slot, class })
}

fn compile_stat_mods(input: &ItemInput) -> Result<StatModOptions, EngineError> {
    let mut minor = [None; STAT_COUNT];
    let mut major_options = [None; STAT_COUNT];
    let mut has_no_mod = false;

    for adjustment in &input.stat_mods {
        match classify_stat_mod(adjustment) {
            StatModKind::None => has_no_mod = true,
            StatModKind::Minor(stat) => {
                minor[stat.index()] = Some(adjustment_index(adjustment, &input.stable_id)?);
            }
            StatModKind::Major(stat) => {
                major_options[stat.index()] = Some(adjustment_index(adjustment, &input.stable_id)?);
            }
            StatModKind::Invalid => {
                return Err(EngineError::InvalidStatMod {
                    item_id: input.stable_id.clone(),
                });
            }
        }
    }

    if !has_no_mod {
        return Err(EngineError::IncompleteStatMods {
            item_id: input.stable_id.clone(),
        });
    }

    let mut major = [0; STAT_COUNT];
    for (stat, source_index) in major_options.into_iter().enumerate() {
        let Some(source_index) = source_index else {
            return Err(EngineError::IncompleteStatMods {
                item_id: input.stable_id.clone(),
            });
        };
        major[stat] = source_index;
    }

    Ok(StatModOptions { minor, major })
}

fn compile_tunings(input: &ItemInput) -> Result<TuningOptions, EngineError> {
    let mut has_no_tuning = false;
    let mut pair_by_code = [None; PAIR_TUNING_COMBINATIONS];
    let mut balanced = None;

    for adjustment in &input.tunings {
        match classify_tuning(adjustment) {
            TuningKind::None => has_no_tuning = true,
            TuningKind::Pair { positive, negative } => {
                pair_by_code[pair_code(positive, negative)].get_or_insert(PairTuning {
                    source_index: adjustment_index(adjustment, &input.stable_id)?,
                    positive,
                    negative,
                });
            }
            TuningKind::Balanced => {
                balanced.get_or_insert(BalancedTuning {
                    source_index: adjustment_index(adjustment, &input.stable_id)?,
                    deltas: adjustment.deltas.into(),
                });
            }
            TuningKind::Invalid => {
                return Err(EngineError::InvalidTuning {
                    item_id: input.stable_id.clone(),
                });
            }
        }
    }

    if !has_no_tuning {
        return Err(EngineError::MissingNoTuning {
            item_id: input.stable_id.clone(),
        });
    }

    let pair_choices = pair_by_code
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .into_boxed_slice();

    Ok(TuningOptions::new(pair_choices, balanced))
}
