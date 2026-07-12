//! Builds request-specific armor candidates and their optimistic suffix bounds.

use crate::domain::{Stat, StatValues};
use crate::item::Item;
use crate::model::SLOT_COUNT;
use crate::request::{Constraints, SetRequirement};

use super::profile::CompiledProfile;

const REQUIRED_SET_PRIORITY: i32 = 10_000;
const TARGETED_STAT_WEIGHT: i32 = 8;
const UNTARGETED_STAT_WEIGHT: i32 = 1;
const BASELINE_STAT_TARGET: i16 = 25;

pub(super) struct CandidatePlan {
    slots: [Box<[usize]>; SLOT_COUNT],
    suffix_potential: [StatValues; SLOT_COUNT + 1],
}

impl CandidatePlan {
    pub fn for_constraints(profile: &CompiledProfile, constraints: &Constraints) -> Option<Self> {
        let mut slots = legendary_candidates(profile, constraints);

        if let Some(item_hash) = constraints.selected_exotic_item_hash
            && !replace_with_exotic_rolls(profile, &mut slots, constraints, item_hash)
        {
            return None;
        }

        if slots.iter().any(Vec::is_empty) {
            return None;
        }

        sort_by_request_priority(&profile.items, &mut slots, constraints);
        let suffix_potential = suffix_potential(&profile.items, &slots, constraints);

        Some(Self {
            slots: slots.map(Vec::into_boxed_slice),
            suffix_potential,
        })
    }

    pub fn candidate_count(&self, slot: usize) -> usize {
        self.slots[slot].len()
    }

    pub fn candidate(&self, slot: usize, index: usize) -> usize {
        self.slots[slot][index]
    }

    pub fn remaining_potential(&self, next_slot: usize) -> &StatValues {
        &self.suffix_potential[next_slot]
    }

    pub fn remaining_combinations(&self, next_slot: usize) -> u64 {
        self.slots[next_slot..]
            .iter()
            .fold(1_u64, |product, candidates| {
                let count = u64::try_from(candidates.len()).unwrap_or(u64::MAX);
                product.saturating_mul(count)
            })
    }

    pub fn sets_are_reachable(
        &self,
        items: &[Item],
        selected: &[usize; SLOT_COUNT],
        next_slot: usize,
        requirements: &[SetRequirement],
    ) -> bool {
        requirements.iter().all(|requirement| {
            let selected_count = selected[..next_slot]
                .iter()
                .filter(|index| items[**index].set_id == Some(requirement.set_id))
                .count();
            let possible_remaining = self.slots[next_slot..]
                .iter()
                .filter(|candidates| {
                    candidates
                        .iter()
                        .any(|index| items[*index].set_id == Some(requirement.set_id))
                })
                .count();

            selected_count + possible_remaining >= requirement.required_pieces
        })
    }
}

fn legendary_candidates(
    profile: &CompiledProfile,
    constraints: &Constraints,
) -> [Vec<usize>; SLOT_COUNT] {
    std::array::from_fn(|slot| {
        profile.by_slot[slot]
            .iter()
            .copied()
            .filter(|index| {
                let item = &profile.items[*index];
                item.compatible_with(constraints.class) && !item.is_exotic
            })
            .collect()
    })
}

fn replace_with_exotic_rolls(
    profile: &CompiledProfile,
    slots: &mut [Vec<usize>; SLOT_COUNT],
    constraints: &Constraints,
    item_hash: u32,
) -> bool {
    for (slot, profile_indexes) in profile.by_slot.iter().enumerate() {
        let rolls = profile_indexes
            .iter()
            .copied()
            .filter(|index| {
                let item = &profile.items[*index];
                item.compatible_with(constraints.class) && item.is_exotic && item.hash == item_hash
            })
            .collect::<Vec<_>>();

        if !rolls.is_empty() {
            slots[slot] = rolls;
            return true;
        }
    }

    false
}

fn sort_by_request_priority(
    items: &[Item],
    slots: &mut [Vec<usize>; SLOT_COUNT],
    constraints: &Constraints,
) {
    for candidates in slots {
        candidates.sort_by(|left, right| {
            target_priority(&items[*right], constraints)
                .cmp(&target_priority(&items[*left], constraints))
                .then_with(|| items[*left].stable_id.cmp(&items[*right].stable_id))
        });
    }
}

fn target_priority(item: &Item, constraints: &Constraints) -> i32 {
    let mut score = 0;

    for stat in Stat::ALL {
        if constraints.is_dump_stat(stat) {
            continue;
        }

        let target = constraints.targets[stat];
        let weight = if target > 0 {
            TARGETED_STAT_WEIGHT
        } else {
            UNTARGETED_STAT_WEIGHT
        };
        let potential = item.base_stats[stat]
            + item.max_tuning_gain(
                stat,
                constraints.dump_stat,
                constraints.allow_balanced_tuning,
            );
        score += i32::from(potential.min(target.max(BASELINE_STAT_TARGET))) * weight;
    }

    if item.set_id.is_some_and(|set_id| {
        constraints
            .set_requirements
            .iter()
            .any(|requirement| requirement.set_id == set_id)
    }) {
        score += REQUIRED_SET_PRIORITY;
    }

    score
}

pub(super) fn item_potential_without_mods(item: &Item, constraints: &Constraints) -> StatValues {
    let mut potential = item.base_stats;
    for stat in Stat::ALL {
        potential[stat] += item.max_tuning_gain(
            stat,
            constraints.dump_stat,
            constraints.allow_balanced_tuning,
        );
    }

    potential
}

fn suffix_potential(
    items: &[Item],
    slots: &[Vec<usize>; SLOT_COUNT],
    constraints: &Constraints,
) -> [StatValues; SLOT_COUNT + 1] {
    let mut suffix = [StatValues::ZERO; SLOT_COUNT + 1];

    for slot in (0..SLOT_COUNT).rev() {
        let mut slot_maximum = StatValues::filled(i16::MIN);

        for item_index in &slots[slot] {
            let potential = item_potential_without_mods(&items[*item_index], constraints);
            for stat in Stat::ALL {
                slot_maximum[stat] = slot_maximum[stat].max(potential[stat]);
            }
        }

        for stat in Stat::ALL {
            suffix[slot][stat] = suffix[slot + 1][stat] + slot_maximum[stat].max(0);
        }
    }

    suffix
}
