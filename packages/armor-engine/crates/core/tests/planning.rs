mod support;

use rose_armor_engine::{CapRequest, EngineError};

use support::{HEALTH, planner_with_rolls, planning_roll, solve_request};

#[test]
fn finds_a_required_roll_recipe() -> Result<(), EngineError> {
    let mut planner = planner_with_rolls(vec![
        planning_roll(0, [30, 25, 20, 5, 5, 5]),
        planning_roll(1, [5, 5, 5, 30, 25, 20]),
    ])?;
    let request = solve_request([150, 125, 100, 0, 0, 0]);
    let result = planner.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.builds[0].item_indices, [0; 5]);
    assert_eq!(result.builds[0].stats, [150, 125, 100, 25, 25, 25]);
    Ok(())
}

#[test]
fn searches_each_roll_multiset_once() -> Result<(), EngineError> {
    let mut planner = planner_with_rolls(vec![
        planning_roll(0, [30, 25, 20, 5, 5, 5]),
        planning_roll(1, [5, 5, 5, 30, 25, 20]),
    ])?;
    let mut request = solve_request([0; 6]);
    request.max_results = 100;
    request.stop_when_result_limit_reached = false;
    let result = planner.solve(request)?;

    assert!(result.ok);
    assert_eq!(result.valid_build_count, 6);
    assert_eq!(result.search.searched_combinations, 6);
    Ok(())
}

#[test]
fn calculates_planning_caps_with_the_shared_mod_budget() -> Result<(), EngineError> {
    let mut planner = planner_with_rolls(vec![planning_roll(0, [30, 25, 20, 5, 5, 5])])?;
    let request = solve_request([0; 6]);
    let result = planner.calculate_caps(CapRequest {
        constraints: request.constraints,
        requested_stats: vec![HEALTH],
    })?;

    assert_eq!(result.caps[usize::from(HEALTH)], 200);
    Ok(())
}
