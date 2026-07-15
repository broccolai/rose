export const CURRENT_GUARDIAN_HEALTH = 230;
export const MIN_WEAPONS_STAT = 100;
export const MAX_WEAPONS_STAT = 200;
export const MAX_PVP_WEAPON_DAMAGE_BONUS = 0.06;

export function clampNumber(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function weaponsStatDamageScalar(weaponsStat: number) {
    const clamped = clampNumber(weaponsStat, MIN_WEAPONS_STAT, MAX_WEAPONS_STAT);
    const progress = (clamped - MIN_WEAPONS_STAT) / (MAX_WEAPONS_STAT - MIN_WEAPONS_STAT);
    return 1 + progress * MAX_PVP_WEAPON_DAMAGE_BONUS;
}
