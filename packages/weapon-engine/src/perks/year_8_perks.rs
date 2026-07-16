use super::{
    add_dmr,
    lib::{DamageModifierResponse, TargetState},
    ModifierResponseInput, Perks,
};

pub fn year_8_perks() {
    add_dmr(
        Perks::StoppingPower,
        Box::new(|input: ModifierResponseInput| {
            DamageModifierResponse::basic_dmg_buff(stopping_power_damage_scale(
                input.calc_data.target_state,
                input.pvp,
            ))
        }),
    );
}

fn stopping_power_damage_scale(target_state: Option<TargetState>, pvp: bool) -> f64 {
    let Some(target) = target_state else {
        return 1.0;
    };

    let health = if pvp {
        target.remaining_health
    } else if target.starting_health > 0.0 {
        target.remaining_health / target.starting_health
    } else {
        return 1.0;
    };

    let (low, critical, near_death) = if pvp {
        (33.0, 23.0, 18.0)
    } else {
        (0.30, 0.23, 0.18)
    };

    if health < near_death {
        1.15
    } else if health < critical {
        1.10
    } else if health < low {
        1.07
    } else {
        1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::perks::is_perk_implemented;

    #[test]
    fn stopping_power_uses_the_manifest_hash_and_is_registered() {
        assert_eq!(u32::from(Perks::StoppingPower), 1_517_798_362);
        assert!(is_perk_implemented(Perks::StoppingPower));
    }

    #[test]
    fn stopping_power_uses_live_pvp_health_before_each_shot() {
        let state = |remaining_health| {
            Some(TargetState {
                starting_health: 230.0,
                remaining_health,
            })
        };

        assert_eq!(stopping_power_damage_scale(None, true), 1.0);
        assert_eq!(stopping_power_damage_scale(state(33.0), true), 1.0);
        assert_eq!(stopping_power_damage_scale(state(32.99), true), 1.07);
        assert_eq!(stopping_power_damage_scale(state(22.99), true), 1.10);
        assert_eq!(stopping_power_damage_scale(state(17.99), true), 1.15);
    }

    #[test]
    fn stopping_power_uses_underlying_health_percentages_in_pve() {
        let state = |remaining_health| {
            Some(TargetState {
                starting_health: 1_000.0,
                remaining_health,
            })
        };

        assert_eq!(stopping_power_damage_scale(state(300.0), false), 1.0);
        assert_eq!(stopping_power_damage_scale(state(299.0), false), 1.07);
        assert_eq!(stopping_power_damage_scale(state(229.0), false), 1.10);
        assert_eq!(stopping_power_damage_scale(state(179.0), false), 1.15);
    }
}
