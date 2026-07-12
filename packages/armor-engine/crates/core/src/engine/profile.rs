//! Compiles normalized armor once into immutable item and slot indexes.

use rustc_hash::FxHashSet;

use crate::error::EngineError;
use crate::item::Item;
use crate::model::{
    ItemInput, PlanningProfileInput, PlanningRollInput, ProfileInput, ProfileSummary, SLOT_COUNT,
};

pub(super) struct CompiledProfile {
    pub items: Box<[Item]>,
    pub by_slot: [Box<[usize]>; SLOT_COUNT],
}

impl CompiledProfile {
    pub fn summary(&self) -> ProfileSummary {
        ProfileSummary {
            item_count: self.items.len(),
            slot_counts: self.by_slot.each_ref().map(|items| items.len()),
        }
    }
}

impl TryFrom<ProfileInput> for CompiledProfile {
    type Error = EngineError;

    fn try_from(profile: ProfileInput) -> Result<Self, Self::Error> {
        let items = compile_items(profile.items)?;
        let by_slot = index_items_by_slot(&items);

        Ok(Self { items, by_slot })
    }
}

pub(super) fn compile_planning_rolls(
    profile: PlanningProfileInput,
) -> Result<Box<[Item]>, EngineError> {
    compile_items(profile.rolls.into_iter().map(planning_roll_item).collect())
}

fn planning_roll_item(roll: PlanningRollInput) -> ItemInput {
    ItemInput {
        source_index: roll.source_index,
        stable_id: roll.stable_id,
        item_hash: roll.source_index,
        slot: 0,
        class_type: 3,
        is_exotic: false,
        set_id: None,
        base_stats: roll.base_stats,
        stat_mods: roll.stat_mods,
        tunings: roll.tunings,
    }
}

fn compile_items(inputs: Vec<ItemInput>) -> Result<Box<[Item]>, EngineError> {
    let mut source_indices = FxHashSet::default();
    let mut stable_ids = FxHashSet::default();
    let mut items = Vec::with_capacity(inputs.len());

    for input in inputs {
        if !source_indices.insert(input.source_index) {
            return Err(EngineError::DuplicateSourceIndex {
                source_index: input.source_index,
            });
        }

        if !stable_ids.insert(input.stable_id.clone()) {
            return Err(EngineError::DuplicateStableId {
                stable_id: input.stable_id,
            });
        }

        items.push(input.try_into()?);
    }

    Ok(items.into_boxed_slice())
}

fn index_items_by_slot(items: &[Item]) -> [Box<[usize]>; SLOT_COUNT] {
    let mut by_slot: [Vec<usize>; SLOT_COUNT] = std::array::from_fn(|_| Vec::new());
    for (index, item) in items.iter().enumerate() {
        by_slot[item.slot.index()].push(index);
    }

    by_slot.map(|mut indexes| {
        indexes.sort_by(|left, right| items[*left].stable_id.cmp(&items[*right].stable_id));
        indexes.into_boxed_slice()
    })
}
