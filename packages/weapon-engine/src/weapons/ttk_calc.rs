use std::collections::HashMap;

use serde::Serialize;

use crate::{
    d2_enums::WeaponType,
    logging::extern_log,
    perks::{
        get_dmg_modifier, get_firing_modifier,
        lib::{CalculationInput, TargetState},
    },
};

use super::{FiringData, Weapon};

//just to make code cleaner for now
fn ceil(x: f64) -> f64 {
    x.ceil()
}

const RESILIENCE_VALUES: [f64; 11] = [
    215.001, 216.001, 217.001, 218.001, 219.001, 220.001, 222.001, 224.001, 226.001, 228.01, 230.00,
];

fn shot_delay(
    weapon_type: WeaponType,
    weapon_hash: u32,
    bullets_hit: f64,
    burst_size: f64,
    burst_delay: f64,
    inner_burst_delay: f64,
) -> f64 {
    let charge_cooldown = if weapon_hash == 4289226715 {
        None
    } else if weapon_type == WeaponType::FUSIONRIFLE {
        Some(0.45)
    } else if weapon_type == WeaponType::LINEARFUSIONRIFLE {
        Some(0.95)
    } else {
        None
    };

    if bullets_hit == 0.0 {
        return if charge_cooldown.is_some() {
            burst_delay
        } else {
            0.0
        };
    }
    if bullets_hit % burst_size > 0.0 {
        return inner_burst_delay;
    }
    burst_delay + charge_cooldown.unwrap_or(0.0)
}

#[derive(Debug, Clone, Serialize)]
pub struct OptimalKillData {
    pub headshots: i32,
    pub bodyshots: i32,
    #[serde(rename = "timeTaken")]
    pub time_taken: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BodyKillData {
    pub bodyshots: i32,
    #[serde(rename = "timeTaken")]
    pub time_taken: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResillienceSummary {
    pub value: i32,
    #[serde(rename = "bodyTtk")]
    pub body_ttk: BodyKillData,
    #[serde(rename = "optimalTtk")]
    pub optimal_ttk: OptimalKillData,
}

#[derive(Debug, Clone, Serialize)]
pub struct TargetHealthSummary {
    #[serde(rename = "targetHealth")]
    pub target_health: f64,
    pub overshield: f64,
    #[serde(rename = "damageScalar")]
    pub damage_scalar: f64,
    #[serde(rename = "bodyTtk")]
    pub body_ttk: BodyKillData,
    #[serde(rename = "optimalTtk")]
    pub optimal_ttk: OptimalKillData,
}

pub fn calc_ttk(_weapon: &Weapon, _overshield: f64) -> Vec<ResillienceSummary> {
    let health_values: Vec<(i32, f64)> = RESILIENCE_VALUES
        .iter()
        .enumerate()
        .map(|(value, health)| (value as i32, *health))
        .collect();
    calc_ttk_for_healths(_weapon, _overshield, 1.0, &health_values)
}

pub fn calc_ttk_at_health(
    weapon: &Weapon,
    target_health: f64,
    overshield: f64,
    damage_scalar: f64,
) -> TargetHealthSummary {
    let target_health = target_health.clamp(1.0, 1000.0);
    let overshield = overshield.clamp(0.0, 1000.0);
    let damage_scalar = damage_scalar.clamp(0.01, 10.0);
    let mut summaries =
        calc_ttk_for_healths(weapon, overshield, damage_scalar, &[(0, target_health)]);
    let summary = summaries.remove(0);
    TargetHealthSummary {
        target_health: target_health + overshield,
        overshield,
        damage_scalar,
        body_ttk: summary.body_ttk,
        optimal_ttk: summary.optimal_ttk,
    }
}

fn calc_ttk_for_healths(
    _weapon: &Weapon,
    overshield: f64,
    damage_scalar: f64,
    health_values: &[(i32, f64)],
) -> Vec<ResillienceSummary> {
    let mut ttk_data: Vec<ResillienceSummary> = Vec::new();
    let mut persistent_data: HashMap<String, f64> = HashMap::new();

    let tmp_dmg_prof = _weapon.get_damage_profile(true);
    let impact_dmg = tmp_dmg_prof.impact_dmg * damage_scalar;
    let explosion_dmg = tmp_dmg_prof.explosion_dmg * damage_scalar;
    let mut crit_mult = tmp_dmg_prof.crit_mult;
    // let damage_delay = tmp_dmg_prof.damage_delay;
    if _weapon.weapon_type == WeaponType::SHOTGUN && _weapon.firing_data.burst_size == 12 {
        crit_mult = 1.0; // shawty has no crits
    }

    for (value, base_health) in health_values {
        let health = base_health + overshield;
        let mut opt_damage_dealt = 0.0_f64;
        let mut opt_time_taken = 0.0_f64;
        let mut opt_bullets_fired = 0.0_f64;
        let mut opt_bullets_hit = 0.0_f64;
        let opt_bodyshots = 0;
        let mut opt_headshots = 0;
        let mut opt_bullet_timeline: Vec<(f64, f64)> = Vec::new();
        let mut mag_expended = 0.0;

        //Optimal ttk
        while opt_bullets_hit < 50.0 {
            //PERK CALCULATIONS////////////

            persistent_data.insert("health%".to_string(), (health - opt_damage_dealt) / 70.0);
            persistent_data.insert("empowering".to_string(), 1.0);
            persistent_data.insert("debuff".to_string(), 1.0);
            persistent_data.insert("surge".to_string(), 1.0);
            let mut calc_input = _weapon.pvp_calc_input(
                opt_bullets_fired,
                opt_bullets_hit,
                opt_time_taken,
                (overshield - opt_damage_dealt) > 0.0,
            );
            calc_input.target_state = Some(TargetState {
                starting_health: *base_health,
                remaining_health: (health - opt_damage_dealt).max(0.0),
            });
            let dmg_mods = get_dmg_modifier(
                _weapon.list_perks().clone(),
                &calc_input,
                true,
                &mut persistent_data,
            );
            let firing_mods = get_firing_modifier(
                _weapon.list_perks().clone(),
                &calc_input,
                true,
                &mut persistent_data,
            );
            ///////////////////////////////

            let body_damage = (impact_dmg * dmg_mods.impact_dmg_scale)
                + (explosion_dmg * dmg_mods.explosive_dmg_scale);
            let critical_multiplier = crit_mult * dmg_mods.crit_scale;
            let head_diff = ((impact_dmg * dmg_mods.impact_dmg_scale) * critical_multiplier)
                - (impact_dmg * dmg_mods.impact_dmg_scale);

            let shot_burst_delay = (_weapon.firing_data.burst_delay + firing_mods.burst_delay_add)
                * firing_mods.burst_delay_scale;
            let shot_inner_burst_delay =
                _weapon.firing_data.inner_burst_delay * firing_mods.inner_burst_scale;
            let shot_burst_size =
                _weapon.firing_data.burst_size as f64 + firing_mods.burst_size_add;

            let mut shot_delay = shot_delay(
                _weapon.weapon_type,
                _weapon.hash,
                opt_bullets_hit,
                shot_burst_size,
                shot_burst_delay,
                shot_inner_burst_delay,
            );

            let ammo_fired = if _weapon.firing_data.one_ammo {
                opt_bullets_hit / shot_burst_size
            } else {
                opt_bullets_fired
            };
            if ammo_fired - mag_expended
                >= _weapon
                    .calc_ammo_sizes(Some(calc_input.clone()), Some(&mut persistent_data), true)
                    .mag_size
                    .into()
            {
                shot_delay += _weapon
                    .calc_reload_time(Some(calc_input.clone()), Some(&mut persistent_data), true)
                    .reload_time;
                mag_expended += ammo_fired;
            }

            if opt_bullets_hit % shot_burst_size == 0.0 {
                opt_bullets_fired += 1.0;
                opt_bullets_hit += 1.0;
            } else {
                opt_bullets_hit += 1.0;
            };

            opt_time_taken += shot_delay;

            opt_bullet_timeline.push((body_damage, head_diff));

            // assume all headshots for first pass
            if (opt_damage_dealt + body_damage + head_diff) >= health {
                opt_headshots += 1;
                opt_damage_dealt += body_damage + head_diff;
                break;
            } else {
                opt_headshots += 1;
                opt_damage_dealt += body_damage + head_diff;
            }
        }

        let mut opt_timeline_damage_dealt = opt_damage_dealt;
        let mut opt_timeline_bodyshots = opt_bodyshots;
        let mut opt_timeline_headshots = opt_headshots;

        // walk back and turn headshots to bodyshots
        for timeline_snapshot in opt_bullet_timeline.iter() {
            let _body_damage = timeline_snapshot.0;
            let headshot_diff = timeline_snapshot.1;

            if opt_timeline_damage_dealt - headshot_diff >= health {
                opt_timeline_bodyshots += 1;
                opt_timeline_headshots -= 1;
                opt_timeline_damage_dealt -= headshot_diff;
            } else {
                break;
            }
        }

        let optimal_ttk = OptimalKillData {
            headshots: opt_timeline_headshots,
            bodyshots: opt_timeline_bodyshots,
            time_taken: opt_time_taken,
        };

        let mut bdy_bullets_hit = 0.0;
        let mut bdy_bullets_fired = 0.0;
        let mut bdy_time_taken = 0.0;
        let mut bdy_damage_dealt = 0.0;
        mag_expended = 0.0;
        while bdy_bullets_hit < 50.0 {
            //PERK CALCULATIONS////////////
            persistent_data.insert("health%".to_string(), (health - bdy_damage_dealt) / 70.0);
            persistent_data.insert("empowering".to_string(), 1.0);
            persistent_data.insert("debuff".to_string(), 1.0);
            persistent_data.insert("surge".to_string(), 1.0);
            let mut calc_input = _weapon.pvp_calc_input(
                bdy_bullets_fired,
                bdy_bullets_hit,
                bdy_time_taken,
                (overshield - bdy_damage_dealt) > 0.0,
            );
            calc_input.target_state = Some(TargetState {
                starting_health: *base_health,
                remaining_health: (health - bdy_damage_dealt).max(0.0),
            });
            let dmg_mods = get_dmg_modifier(
                _weapon.list_perks().clone(),
                &calc_input,
                true,
                &mut persistent_data,
            );
            let firing_mods = get_firing_modifier(
                _weapon.list_perks().clone(),
                &calc_input,
                true,
                &mut persistent_data,
            );
            ///////////////////////////////

            let tmp_dmg_prof = _weapon.get_damage_profile(true);
            let impact_dmg = tmp_dmg_prof.impact_dmg * damage_scalar;
            let explosion_dmg = tmp_dmg_prof.explosion_dmg * damage_scalar;

            let body_damage = (impact_dmg * dmg_mods.impact_dmg_scale)
                + (explosion_dmg * dmg_mods.explosive_dmg_scale);

            let shot_burst_delay = (_weapon.firing_data.burst_delay + firing_mods.burst_delay_add)
                * firing_mods.burst_delay_scale;
            let shot_inner_burst_delay =
                _weapon.firing_data.inner_burst_delay * firing_mods.inner_burst_scale;
            let shot_burst_size =
                _weapon.firing_data.burst_size as f64 + firing_mods.burst_size_add;

            let mut shot_delay = shot_delay(
                _weapon.weapon_type,
                _weapon.hash,
                bdy_bullets_hit,
                shot_burst_size,
                shot_burst_delay,
                shot_inner_burst_delay,
            );

            let ammo_fired = if _weapon.firing_data.one_ammo {
                bdy_bullets_hit / shot_burst_size
            } else {
                bdy_bullets_fired
            };
            if ammo_fired - mag_expended
                >= _weapon
                    .calc_ammo_sizes(Some(calc_input.clone()), Some(&mut persistent_data), true)
                    .mag_size
                    .into()
            {
                shot_delay += _weapon
                    .calc_reload_time(Some(calc_input.clone()), Some(&mut persistent_data), true)
                    .reload_time;
                mag_expended += ammo_fired;
            }

            bdy_time_taken += shot_delay;
            if bdy_bullets_hit % shot_burst_size == 0.0 {
                bdy_bullets_fired += 1.0;
                bdy_bullets_hit += 1.0;
            } else {
                bdy_bullets_hit += 1.0;
            };

            if (bdy_damage_dealt + body_damage) >= health {
                break;
            } else {
                bdy_damage_dealt += body_damage;
            }
        }
        let body_ttk = BodyKillData {
            time_taken: bdy_time_taken,
            bodyshots: bdy_bullets_hit as i32,
        };
        ttk_data.push(ResillienceSummary {
            value: *value,
            body_ttk,
            optimal_ttk,
        });
    }
    ttk_data
}

impl Weapon {
    pub fn calc_ttk(&self, _overshield: f64) -> Vec<ResillienceSummary> {
        calc_ttk(self, _overshield)
    }
}

#[cfg(test)]
mod tests {
    use super::shot_delay;
    use crate::d2_enums::WeaponType;

    fn assert_close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-9,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn charged_weapons_include_the_initial_charge_and_inter_volley_cooldown() {
        assert_close(
            shot_delay(WeaponType::LINEARFUSIONRIFLE, 1, 0.0, 1.0, 0.533, 0.0),
            0.533,
        );
        assert_close(
            shot_delay(WeaponType::LINEARFUSIONRIFLE, 1, 1.0, 1.0, 0.533, 0.0),
            1.483,
        );
        assert_close(
            shot_delay(WeaponType::FUSIONRIFLE, 1, 1.0, 7.0, 0.783, 0.033),
            0.033,
        );
        assert_close(
            shot_delay(WeaponType::FUSIONRIFLE, 1, 7.0, 7.0, 0.783, 0.033),
            1.233,
        );
    }

    #[test]
    fn conventional_weapons_keep_zero_time_to_the_first_projectile() {
        assert_eq!(
            shot_delay(WeaponType::HANDCANNON, 1, 0.0, 1.0, 0.5, 0.0),
            0.0
        );
        assert_eq!(
            shot_delay(WeaponType::FUSIONRIFLE, 4289226715, 0.0, 1.0, 0.1, 0.0),
            0.0
        );
    }
}
