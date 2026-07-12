mod support;

use rose_armor_engine::EngineError;

use support::{
    HEALTH, engine_with_items, legendary_armor_set, major_mod_source, minor_mod_source,
    solve_request,
};

#[test]
fn solves_an_exact_legendary_build_without_adjustments() -> Result<(), EngineError> {
    let mut engine = engine_with_items(legendary_armor_set([5; 6]))?;
    let result = engine.solve(solve_request([25; 6]))?;

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [25; 6]);
    assert_eq!(result.builds[0].stat_mod_indices, [-1; 5]);
    assert_eq!(result.builds[0].tuning_indices, [-1; 5]);
    Ok(())
}

#[test]
fn shares_only_five_major_mods_across_all_stats() -> Result<(), EngineError> {
    let mut engine = engine_with_items(legendary_armor_set([0; 6]))?;
    let mut request = solve_request([0; 6]);
    request.constraints.targets = [30, 20, 0, 0, 0, 0];
    let result = engine.solve(request)?;

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
    assert!(!engine.solve(impossible)?.ok);
    Ok(())
}

#[test]
fn uses_a_minor_mod_at_the_display_cap() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    for armor in &mut items {
        armor.base_stats[usize::from(HEALTH)] = 39;
    }

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.targets[usize::from(HEALTH)] = 200;
    let result = engine.solve(request)?;

    assert_eq!(result.builds[0].stats[usize::from(HEALTH)], 200);
    assert_eq!(
        result.builds[0].stat_mod_indices[0],
        minor_mod_source(HEALTH)
    );
    Ok(())
}

#[test]
fn keeps_a_major_mod_when_a_minor_mod_would_miss_the_target() -> Result<(), EngineError> {
    let mut items = legendary_armor_set([0; 6]);
    for (index, armor) in items.iter_mut().enumerate() {
        armor.base_stats[usize::from(HEALTH)] = if index == 0 { 39 } else { 38 };
    }

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.constraints.targets[usize::from(HEALTH)] = 200;
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].stats[usize::from(HEALTH)], 200);
    assert_eq!(
        result.builds[0].stat_mod_indices[0],
        major_mod_source(HEALTH)
    );
    Ok(())
}

#[test]
fn applies_positive_and_negative_fragment_bonuses() -> Result<(), EngineError> {
    let mut engine = engine_with_items(legendary_armor_set([5; 6]))?;
    let mut request = solve_request([0; 6]);
    request.constraints.stat_bonuses = [20, -20, 0, 10, 10, 0];
    request.constraints.targets = [45, 5, 25, 35, 35, 25];
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].stats, [45, 5, 25, 35, 35, 25]);
    Ok(())
}
