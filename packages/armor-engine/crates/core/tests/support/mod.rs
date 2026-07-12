#![allow(
    dead_code,
    reason = "each integration test compiles this shared fixture module as a separate crate"
)]

use rose_armor_engine::{
    AdjustmentInput, ArmorEngine, ConstraintsInput, EngineError, ItemInput, ProfileInput,
    SolveRequest, Stats,
};

pub const TITAN: u8 = 0;
pub const HEALTH: u8 = 0;
pub const MELEE: u8 = 1;
pub const WEAPONS: u8 = 5;
pub const HELMET: u8 = 0;
pub const ARMS: u8 = 1;
pub const LEGS: u8 = 3;

pub fn engine_with_items(items: Vec<ItemInput>) -> Result<ArmorEngine, EngineError> {
    ArmorEngine::new(ProfileInput { items })
}

pub fn solve_request(targets: Stats) -> SolveRequest {
    SolveRequest {
        constraints: ConstraintsInput {
            class_type: TITAN,
            selected_exotic_item_hash: None,
            dump_stat: None,
            allow_balanced_tuning: false,
            targets,
            stat_bonuses: [0; 6],
            set_requirements: Vec::new(),
        },
        max_results: 50,
        result_sort: None,
        stop_when_result_limit_reached: true,
    }
}

pub fn item(source_index: u32, slot: u8, base_stats: Stats) -> ItemInput {
    ItemInput {
        source_index,
        stable_id: format!("item-{source_index}"),
        item_hash: source_index + 100,
        slot,
        class_type: TITAN,
        is_exotic: false,
        set_id: None,
        base_stats,
        stat_mods: standard_mods(),
        tunings: vec![no_adjustment(0)],
    }
}

pub fn legendary_armor_set(base_stats: Stats) -> Vec<ItemInput> {
    (0_u8..5)
        .map(|slot| item(u32::from(slot), slot, base_stats))
        .collect()
}

pub const fn no_adjustment(source_index: u16) -> AdjustmentInput {
    AdjustmentInput {
        source_index,
        deltas: [0; 6],
    }
}

pub fn minor_mod_source(stat: u8) -> i16 {
    i16::from(stat) * 2 + 1
}

pub fn major_mod_source(stat: u8) -> i16 {
    i16::from(stat) * 2 + 2
}

fn standard_mods() -> Vec<AdjustmentInput> {
    let mut options = vec![no_adjustment(0)];
    for stat in 0_u8..6 {
        let stat_index = usize::from(stat);
        let mut minor = [0; 6];
        minor[stat_index] = 5;
        options.push(AdjustmentInput {
            source_index: minor_mod_source(stat).cast_unsigned(),
            deltas: minor,
        });

        let mut major = [0; 6];
        major[stat_index] = 10;
        options.push(AdjustmentInput {
            source_index: major_mod_source(stat).cast_unsigned(),
            deltas: major,
        });
    }

    options
}
