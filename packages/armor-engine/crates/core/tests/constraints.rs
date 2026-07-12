mod support;

#[path = "support/tunings.rs"]
mod tuning_support;

use rose_armor_engine::{CapRequest, EngineError, SetRequirementInput, SolveRequest};

use support::{
    HEALTH, LEGS, MELEE, WEAPONS, engine_with_items, item, legendary_armor_set, solve_request,
};
use tuning_support::full_pair_tunings;

#[test]
fn enforces_two_and_four_piece_set_requirements() -> Result<(), EngineError> {
    let mut items = Vec::new();
    for slot in 0_u8..5 {
        let source_index = u32::from(slot) * 2;
        let mut set_item = item(source_index, slot, [5; 6]);
        set_item.set_id = Some(77);
        items.push(set_item);
        items.push(item(source_index + 1, slot, [10; 6]));
    }

    let mut engine = engine_with_items(items)?;
    let mut two_piece = solve_request([0; 6]);
    two_piece
        .constraints
        .set_requirements
        .push(SetRequirementInput {
            set_id: 77,
            required_pieces: 2,
        });
    let result = engine.solve(two_piece)?;
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
    let result = engine.solve(four_piece)?;
    assert!(result.ok);
    assert!(
        result.builds[0]
            .item_indices
            .iter()
            .filter(|index| **index % 2 == 0)
            .count()
            >= 4
    );
    Ok(())
}

#[test]
fn selected_exotic_hash_tries_every_roll_and_is_required_exactly_once() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    let mut weak = item(10, LEGS, [0; 6]);
    weak.item_hash = 999;
    weak.is_exotic = true;
    let mut strong = item(11, LEGS, [0; 6]);
    strong.item_hash = 999;
    strong.is_exotic = true;
    strong.base_stats[usize::from(WEAPONS)] = 50;
    items.extend([weak, strong]);
    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.selected_exotic_item_hash = Some(999);
    request.constraints.targets[usize::from(WEAPONS)] = 100;
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].item_indices[usize::from(LEGS)], 11);
    Ok(())
}

#[test]
fn selected_exotic_variant_tries_only_matching_perk_rolls() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    let mut wrong_perks = item(10, LEGS, [0; 6]);
    wrong_perks.item_hash = 999;
    wrong_perks.is_exotic = true;
    wrong_perks.exotic_variant_id = Some(1);
    wrong_perks.base_stats[usize::from(WEAPONS)] = 50;

    let mut matching_weak = item(11, LEGS, [0; 6]);
    matching_weak.item_hash = 999;
    matching_weak.is_exotic = true;
    matching_weak.exotic_variant_id = Some(2);

    let mut matching_strong = item(12, LEGS, [0; 6]);
    matching_strong.item_hash = 999;
    matching_strong.is_exotic = true;
    matching_strong.exotic_variant_id = Some(2);
    matching_strong.base_stats[usize::from(WEAPONS)] = 40;

    items.extend([wrong_perks, matching_weak, matching_strong]);
    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.selected_exotic_item_hash = Some(999);
    request.constraints.selected_exotic_variant_id = Some(2);
    request.constraints.targets[usize::from(WEAPONS)] = 90;
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].item_indices[usize::from(LEGS)], 12);
    Ok(())
}

#[test]
fn cap_and_solve_use_the_same_constraints() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    for armor in &mut items {
        armor.base_stats[usize::from(WEAPONS)] = 20;
        armor.tunings = full_pair_tunings();
    }

    let mut engine = engine_with_items(items)?;
    let mut constraints = solve_request([0; 6]).constraints;
    constraints.dump_stat = Some(HEALTH);
    constraints.targets[usize::from(MELEE)] = 25;
    let caps = engine.calculate_caps(CapRequest {
        constraints: constraints.clone(),
        requested_stats: vec![WEAPONS],
    })?;
    assert_eq!(caps.caps[usize::from(WEAPONS)], 150);

    constraints.targets[usize::from(WEAPONS)] = caps.caps[usize::from(WEAPONS)];
    assert!(
        engine
            .solve(SolveRequest {
                constraints,
                max_results: 1,
                result_sort: None,
                stop_when_result_limit_reached: true,
            })?
            .ok
    );
    Ok(())
}
