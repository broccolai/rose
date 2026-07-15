use super::{add_dmr, lib::DamageModifierResponse, ModifierResponseInput, Perks};

pub fn year_8_perks() {
    add_dmr(
        Perks::StoppingPower,
        Box::new(|input: ModifierResponseInput| {
            DamageModifierResponse::basic_dmg_buff(stopping_power_damage_scale(input.value))
        }),
    );
}

fn stopping_power_damage_scale(value: u32) -> f64 {
    match value {
        0 => 1.0,
        1 => 1.07,
        2 => 1.10,
        3.. => 1.15,
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
    fn stopping_power_maps_manual_health_tiers_to_damage_scalars() {
        assert_eq!(stopping_power_damage_scale(0), 1.0);
        assert_eq!(stopping_power_damage_scale(1), 1.07);
        assert_eq!(stopping_power_damage_scale(2), 1.10);
        assert_eq!(stopping_power_damage_scale(3), 1.15);
    }
}
