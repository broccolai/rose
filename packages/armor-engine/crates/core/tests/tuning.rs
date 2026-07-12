mod support;

#[path = "support/tunings.rs"]
mod tuning_support;

use rose_armor_engine::{AdjustmentInput, EngineError};

use support::{
    HEALTH, MELEE, WEAPONS, engine_with_items, legendary_armor_set, no_adjustment, solve_request,
};
use tuning_support::full_pair_tunings;

#[test]
fn applies_only_dump_stat_pair_tuning_when_balanced_is_off() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    for armor in &mut items {
        armor.tunings = full_pair_tunings();
    }

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.dump_stat = Some(HEALTH);
    request.constraints.targets[usize::from(MELEE)] = 25;
    request.constraints.targets[usize::from(WEAPONS)] = 50;
    let result = engine.solve(request)?;

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
    Ok(())
}

#[test]
fn moves_surplus_with_pair_tuning_when_there_is_no_dump_stat() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([5, 0, 0, 0, 0, 0]);
    for armor in &mut items {
        armor.tunings = full_pair_tunings();
    }

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.targets[usize::from(MELEE)] = 25;
    request.constraints.targets[usize::from(WEAPONS)] = 50;
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [0, 25, 0, 0, 0, 50]);
    Ok(())
}

#[test]
fn balanced_tuning_is_strictly_opt_in() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    for armor in &mut items {
        armor.tunings = vec![
            no_adjustment(0),
            AdjustmentInput {
                source_index: 1,
                deltas: [1, 1, 1, 0, 0, 0],
            },
        ];
    }

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.targets[usize::from(HEALTH)] = 5;
    request.constraints.targets[usize::from(WEAPONS)] = 50;
    assert!(!engine.solve(request.clone())?.ok);

    request.constraints.allow_balanced_tuning = true;
    let result = engine.solve(request)?;
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
    Ok(())
}
