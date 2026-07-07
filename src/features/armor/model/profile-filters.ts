import { ARMOR_SLOTS, type ArmorItem } from '@armor-calc';

import type { NormalizedArmorProfile } from '@/features/armor/types';

export const filterFullyMasterworkedProfile = (profile: NormalizedArmorProfile | null, enabled: boolean): NormalizedArmorProfile | null => {
    if (!profile || !enabled) {
        return profile;
    }

    const armor = profile.armor.map((item) => keepFullyMasterworkedItem(item)).filter((item): item is ArmorItem => Boolean(item));

    return {
        ...profile,
        armor,
        armorBySlot: groupArmorBySlotForProfile(armor)
    };
};

export const keepFullyMasterworkedItem = (item: ArmorItem): ArmorItem | null => {
    const fullyMasterworkedIds = item.fullyMasterworkedItemInstanceIds ?? (item.isCurrentMasterworked ? [item.itemInstanceId] : []);
    if (fullyMasterworkedIds.length === 0) {
        return null;
    }

    return {
        ...item,
        itemInstanceId: fullyMasterworkedIds[0],
        equivalentItemInstanceIds: fullyMasterworkedIds,
        fullyMasterworkedItemInstanceIds: fullyMasterworkedIds,
        isCurrentMasterworked: true
    };
};

export const groupArmorBySlotForProfile = (armor: ArmorItem[]): NormalizedArmorProfile['armorBySlot'] =>
    Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [slot, armor.filter((item) => item.slot === slot)])
    ) as NormalizedArmorProfile['armorBySlot'];
