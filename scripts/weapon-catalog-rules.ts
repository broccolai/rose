export function isPlugAllowedBySocketType(plugCategoryHash: number, whitelist: readonly number[], isInitialPlug: boolean) {
    return isInitialPlug || whitelist.length === 0 || whitelist.includes(plugCategoryHash);
}

export function masterworkFamilyKey(weaponType: string, intrinsicName: string) {
    return `${weaponType.trim().toLocaleLowerCase()}|${intrinsicName.trim().toLocaleLowerCase()}`;
}

export function masterworkStatName(plugName: string) {
    return /^(?:Masterworked|Tier \d+):\s*(.+)$/.exec(plugName)?.[1] ?? null;
}

export function isObservedWeaponMasterwork(
    observedStats: ReadonlyMap<string, ReadonlySet<string>>,
    weaponType: string,
    intrinsicName: string,
    plugName: string
) {
    const statName = masterworkStatName(plugName);
    return Boolean(statName && observedStats.get(masterworkFamilyKey(weaponType, intrinsicName))?.has(statName));
}
