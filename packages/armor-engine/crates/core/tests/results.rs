mod support;

use rose_armor_engine::{EngineError, SortInput};

use support::{HEALTH, HELMET, engine_with_items, item, legendary_armor_set, solve_request};

#[test]
fn sorted_results_count_every_build_but_retain_only_the_requested_best() -> Result<(), EngineError>
{
    let mut items = legendary_armor_set([0; 6]);
    let mut stronger_helmet = item(10, HELMET, [0; 6]);
    stronger_helmet.base_stats[usize::from(HEALTH)] = 20;
    items.push(stronger_helmet);

    let mut engine = engine_with_items(items)?;
    let mut request = solve_request([0; 6]);
    request.max_results = 1;
    request.result_sort = Some(SortInput {
        key: HEALTH,
        descending: true,
    });
    let result = engine.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.valid_build_count, 2);
    assert_eq!(result.returned_build_count, 1);
    assert!(result.result_limit_reached);
    assert_eq!(result.builds[0].item_indices[0], 10);
    assert_eq!(result.builds[0].stats[usize::from(HEALTH)], 20);
    Ok(())
}

#[test]
fn missing_armor_slot_returns_a_stable_failure() -> Result<(), EngineError> {
    let mut engine = engine_with_items(vec![item(1, HELMET, [0; 6])])?;
    let result = engine.solve(solve_request([0; 6]))?;

    assert!(!result.ok);
    assert_eq!(
        result.reason.as_deref(),
        Some("No compatible armor found for every armor slot.")
    );
    assert!(result.builds.is_empty());
    Ok(())
}
