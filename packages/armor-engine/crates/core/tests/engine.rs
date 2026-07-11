use rose_armor_engine::{
    AdjustmentInput, ArmorEngine, CapRequest, ItemInput, ProfileInput, Request,
    SetRequirementInput, SolveRequest, Stats,
};

const TITAN: u8 = 0;

#[test]
fn solves_an_exact_legendary_build_without_addons() {
    let mut engine = engine_with_items((0..5).map(|slot| item(slot, slot as u8, [5; 6])).collect());
    let result = engine.solve(solve_request([25; 6])).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [25; 6]);
    assert_eq!(result.builds[0].stat_mod_indices, [-1; 5]);
    assert_eq!(result.builds[0].tuning_indices, [-1; 5]);
}

#[test]
fn shares_only_five_major_mods_across_all_stats() {
    let mut engine = engine_with_items((0..5).map(|slot| item(slot, slot as u8, [0; 6])).collect());
    let mut request = solve_request([0; 6]);
    request.constraints.targets = [30, 20, 0, 0, 0, 0];
    let result = engine.solve(request).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [30, 20, 0, 0, 0, 0]);
    assert_eq!(
        result.builds[0]
            .stat_mod_indices
            .iter()
            .filter(|index| **index >= 0)
            .count(),
        5
    );

    let mut impossible = solve_request([0; 6]);
    impossible.constraints.targets = [30, 30, 0, 0, 0, 0];
    assert!(!engine.solve(impossible).unwrap().ok);
}

#[test]
fn uses_a_minor_mod_at_the_display_cap() {
    let mut items = (0..5)
        .map(|slot| item(slot, slot as u8, [0; 6]))
        .collect::<Vec<_>>();
    for armor in &mut items {
        armor.base_stats[0] = 39;
    }
    let mut engine = engine_with_items(items);
    let mut request = solve_request([0; 6]);
    request.constraints.targets[0] = 200;
    let result = engine.solve(request).unwrap();

    assert_eq!(result.builds[0].stats[0], 200);
    assert_eq!(result.builds[0].stat_mod_indices[0], minor_mod_source(0));
}

#[test]
fn applies_only_dump_stat_pair_tuning_when_balanced_is_off() {
    let mut items = (0..5)
        .map(|slot| item(slot, slot as u8, [0; 6]))
        .collect::<Vec<_>>();
    for armor in &mut items {
        armor.tunings = full_pair_tunings(false);
    }
    let mut engine = engine_with_items(items);
    let mut request = solve_request([0; 6]);
    request.constraints.dump_stat = Some(0);
    request.constraints.targets[1] = 25;
    request.constraints.targets[5] = 50;
    let result = engine.solve(request).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [0, 25, 0, 0, 0, 50]);
    assert_eq!(
        result.builds[0]
            .tuning_indices
            .iter()
            .filter(|index| **index >= 0)
            .count(),
        5
    );
    assert_eq!(
        result.builds[0]
            .stat_mod_indices
            .iter()
            .filter(|index| **index >= 0)
            .count(),
        5
    );
}

#[test]
fn moves_surplus_with_pair_tuning_when_there_is_no_dump_stat() {
    let mut items = (0..5)
        .map(|slot| item(slot, slot as u8, [5, 0, 0, 0, 0, 0]))
        .collect::<Vec<_>>();
    for armor in &mut items {
        armor.tunings = full_pair_tunings(false);
    }
    let mut engine = engine_with_items(items);
    let mut request = solve_request([0; 6]);
    request.constraints.targets[1] = 25;
    request.constraints.targets[5] = 50;
    let result = engine.solve(request).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [0, 25, 0, 0, 0, 50]);
}

#[test]
fn balanced_tuning_is_strictly_opt_in() {
    let mut items = (0..5)
        .map(|slot| item(slot, slot as u8, [0; 6]))
        .collect::<Vec<_>>();
    for armor in &mut items {
        armor.tunings = vec![
            no_adjustment(0),
            AdjustmentInput {
                source_index: 1,
                deltas: [1, 1, 1, 0, 0, 0],
            },
        ];
    }
    let mut engine = engine_with_items(items);
    let mut request = solve_request([0; 6]);
    request.constraints.targets[0] = 5;
    request.constraints.targets[5] = 50;
    assert!(!engine.solve(request.clone()).unwrap().ok);

    request.constraints.allow_balanced_tuning = true;
    let result = engine.solve(request).unwrap();
    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [5, 5, 5, 0, 0, 50]);
    assert_eq!(
        result.builds[0]
            .tuning_indices
            .iter()
            .filter(|index| **index >= 0)
            .count(),
        5
    );
}

#[test]
fn applies_positive_and_negative_fragment_bonuses() {
    let mut engine = engine_with_items((0..5).map(|slot| item(slot, slot as u8, [5; 6])).collect());
    let mut request = solve_request([0; 6]);
    request.constraints.stat_bonuses = [20, -20, 0, 10, 10, 0];
    request.constraints.targets = [45, 5, 25, 35, 35, 25];
    let result = engine.solve(request).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [45, 5, 25, 35, 35, 25]);
}

#[test]
fn enforces_two_and_four_piece_set_requirements() {
    let mut items = Vec::new();
    for slot in 0..5 {
        let mut set_item = item(slot * 2, slot as u8, [5; 6]);
        set_item.set_id = Some(77);
        items.push(set_item);
        items.push(item(slot * 2 + 1, slot as u8, [10; 6]));
    }
    let mut engine = engine_with_items(items);
    let mut two_piece = solve_request([0; 6]);
    two_piece
        .constraints
        .set_requirements
        .push(SetRequirementInput {
            set_id: 77,
            required_pieces: 2,
        });
    let result = engine.solve(two_piece).unwrap();
    assert!(result.ok);
    assert!(
        result.builds[0]
            .item_indices
            .iter()
            .filter(|index| **index % 2 == 0)
            .count()
            >= 2
    );

    let mut four_piece = solve_request([0; 6]);
    four_piece
        .constraints
        .set_requirements
        .push(SetRequirementInput {
            set_id: 77,
            required_pieces: 4,
        });
    let result = engine.solve(four_piece).unwrap();
    assert!(result.ok);
    assert!(
        result.builds[0]
            .item_indices
            .iter()
            .filter(|index| **index % 2 == 0)
            .count()
            >= 4
    );
}

#[test]
fn selected_exotic_hash_tries_every_roll_and_is_required_exactly_once() {
    let mut items = Vec::new();
    for slot in 0..5 {
        items.push(item(slot, slot as u8, [0; 6]));
    }
    let mut weak = item(10, 3, [0; 6]);
    weak.item_hash = 999;
    weak.is_exotic = true;
    let mut strong = item(11, 3, [0; 6]);
    strong.item_hash = 999;
    strong.is_exotic = true;
    strong.base_stats[5] = 50;
    items.extend([weak, strong]);
    let mut engine = engine_with_items(items);
    let mut request = solve_request([0; 6]);
    request.constraints.selected_exotic_item_hash = Some(999);
    request.constraints.targets[5] = 100;
    let result = engine.solve(request).unwrap();

    assert!(result.ok);
    assert_eq!(result.builds[0].item_indices[3], 11);
}

#[test]
fn cap_and_solve_use_the_same_constraints() {
    let mut items = (0..5)
        .map(|slot| item(slot, slot as u8, [0; 6]))
        .collect::<Vec<_>>();
    for armor in &mut items {
        armor.base_stats[5] = 20;
        armor.tunings = full_pair_tunings(false);
    }
    let mut engine = engine_with_items(items);
    let mut constraints = solve_request([0; 6]).constraints;
    constraints.dump_stat = Some(0);
    constraints.targets[1] = 25;
    let caps = engine
        .calculate_caps(CapRequest {
            constraints: constraints.clone(),
            requested_stats: vec![5],
        })
        .unwrap();
    assert_eq!(caps.caps[5], 150);

    constraints.targets[5] = caps.caps[5];
    assert!(
        engine
            .solve(SolveRequest {
                constraints,
                max_results: 1,
                result_sort: None,
                stop_when_result_limit_reached: true,
            })
            .unwrap()
            .ok
    );
}

fn engine_with_items(items: Vec<ItemInput>) -> ArmorEngine {
    ArmorEngine::new(ProfileInput { items }).unwrap()
}

fn solve_request(targets: Stats) -> SolveRequest {
    SolveRequest {
        constraints: Request {
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

fn item(source_index: u32, slot: u8, base_stats: Stats) -> ItemInput {
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

fn standard_mods() -> Vec<AdjustmentInput> {
    let mut options = vec![no_adjustment(0)];
    for stat in 0..6 {
        let mut minor = [0; 6];
        minor[stat] = 5;
        options.push(AdjustmentInput {
            source_index: minor_mod_source(stat) as u16,
            deltas: minor,
        });
        let mut major = [0; 6];
        major[stat] = 10;
        options.push(AdjustmentInput {
            source_index: major_mod_source(stat) as u16,
            deltas: major,
        });
    }
    options
}

fn full_pair_tunings(balanced: bool) -> Vec<AdjustmentInput> {
    let mut options = vec![no_adjustment(0)];
    for positive in 0..6 {
        for negative in 0..6 {
            if positive == negative {
                continue;
            }
            let mut deltas = [0; 6];
            deltas[positive] = 5;
            deltas[negative] = -5;
            options.push(AdjustmentInput {
                source_index: options.len() as u16,
                deltas,
            });
        }
    }
    if balanced {
        options.push(AdjustmentInput {
            source_index: options.len() as u16,
            deltas: [1, 1, 1, 0, 0, 0],
        });
    }
    options
}

fn no_adjustment(source_index: u16) -> AdjustmentInput {
    AdjustmentInput {
        source_index,
        deltas: [0; 6],
    }
}

fn minor_mod_source(stat: usize) -> i16 {
    (stat * 2 + 1) as i16
}

fn major_mod_source(stat: usize) -> i16 {
    (stat * 2 + 2) as i16
}
