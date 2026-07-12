mod support;

use rose_armor_engine::{EngineError, SetRequirementInput};

use support::{ARMS, HELMET, engine_with_items, item, legendary_armor_set, solve_request};

#[test]
fn rejects_duplicate_profile_identities() {
    let armor = item(7, HELMET, [0; 6]);
    assert_eq!(
        engine_with_items(vec![armor.clone(), armor]).err(),
        Some(EngineError::DuplicateSourceIndex { source_index: 7 })
    );

    let mut first = item(1, HELMET, [0; 6]);
    first.stable_id = "same-instance".into();
    let mut second = item(2, ARMS, [0; 6]);
    second.stable_id = "same-instance".into();
    assert_eq!(
        engine_with_items(vec![first, second]).err(),
        Some(EngineError::DuplicateStableId {
            stable_id: "same-instance".into()
        })
    );
}

#[test]
fn rejects_malformed_mod_and_tuning_catalogs() {
    let mut missing_mods = item(1, HELMET, [0; 6]);
    missing_mods.stat_mods.truncate(1);
    assert_eq!(
        engine_with_items(vec![missing_mods]).err(),
        Some(EngineError::IncompleteStatMods {
            item_id: "item-1".into()
        })
    );

    let mut missing_no_tuning = item(2, HELMET, [0; 6]);
    missing_no_tuning.tunings.clear();
    assert_eq!(
        engine_with_items(vec![missing_no_tuning]).err(),
        Some(EngineError::MissingNoTuning {
            item_id: "item-2".into()
        })
    );
}

#[test]
fn rejects_invalid_or_duplicate_request_constraints() -> Result<(), EngineError> {
    let mut engine = engine_with_items(legendary_armor_set([0; 6]))?;

    let mut invalid_dump = solve_request([0; 6]);
    invalid_dump.constraints.dump_stat = Some(9);
    assert_eq!(
        engine.solve(invalid_dump).err(),
        Some(EngineError::InvalidDumpStat { stat: 9 })
    );

    let mut duplicate_set = solve_request([0; 6]);
    duplicate_set.constraints.set_requirements = vec![
        SetRequirementInput {
            set_id: 42,
            required_pieces: 2,
        },
        SetRequirementInput {
            set_id: 42,
            required_pieces: 4,
        },
    ];
    assert_eq!(
        engine.solve(duplicate_set).err(),
        Some(EngineError::DuplicateSetRequirement { set_id: 42 })
    );

    let mut excessive_results = solve_request([0; 6]);
    excessive_results.max_results = 100_001;
    assert_eq!(
        engine.solve(excessive_results).err(),
        Some(EngineError::ResultLimitTooLarge {
            requested: 100_001,
            maximum: 100_000
        })
    );

    Ok(())
}
