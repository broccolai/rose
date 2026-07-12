//! Computes optimistic bounds used to reject impossible search branches.

use crate::domain::{MajorModRequirements, Stat, StatValues, remaining_major_mod_bonus};
use crate::model::{MAX_STAT, SLOT_COUNT};
use crate::request::RequestedStats;

pub(super) fn targets_are_reachable(
    selected_potential: &StatValues,
    remaining_potential: &StatValues,
    targets: &StatValues,
    dump_stat: Option<Stat>,
) -> bool {
    MajorModRequirements::from_combined_stats(
        selected_potential,
        remaining_potential,
        targets,
        dump_stat,
    )
    .total()
        <= SLOT_COUNT
}

pub(super) fn any_cap_can_improve(
    selected_potential: &StatValues,
    remaining_potential: &StatValues,
    targets: &StatValues,
    dump_stat: Option<Stat>,
    requested: RequestedStats,
    caps: &StatValues,
) -> bool {
    let required_mods = MajorModRequirements::from_combined_stats(
        selected_potential,
        remaining_potential,
        targets,
        dump_stat,
    );

    for score_stat in Stat::ALL {
        if !requested.contains(score_stat)
            || dump_stat == Some(score_stat)
            || caps[score_stat] >= MAX_STAT
        {
            continue;
        }

        let Some(remaining_mod_points) =
            remaining_major_mod_bonus(required_mods.excluding(score_stat))
        else {
            continue;
        };
        let potential = selected_potential[score_stat]
            .saturating_add(remaining_potential[score_stat])
            .saturating_add(remaining_mod_points)
            .clamp(0, MAX_STAT);

        if potential > caps[score_stat] {
            return true;
        }
    }

    false
}
