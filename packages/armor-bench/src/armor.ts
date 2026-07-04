import { ARMOR_SLOTS, type ArmorInventoryBySlot, type ArmorItem, dedupeEquivalentArmorItems, NO_TUNING } from '../../armor-calc/src';
import type { BenchmarkScenario, LoadedBenchmarkBundle, PreparedScenario } from './types';

export function prepareScenario(bundle: LoadedBenchmarkBundle, scenario: BenchmarkScenario): PreparedScenario {
    const armor = bundle.normalizedProfile?.armor ?? [];
    const classArmor = armor
        .filter((item) => item.classType === 'any' || item.classType === scenario.classType)
        .map((item) => (scenario.disableTuning ? { ...item, tuningOptions: [NO_TUNING] } : item));
    const selectedArmor = scenario.selectedExoticItemHash
        ? classArmor.filter((item) => !item.isExotic || item.itemHash === scenario.selectedExoticItemHash)
        : classArmor;
    const scenarioArmor = applySyntheticSets(selectedArmor, scenario);
    const dedupedArmor = dedupeEquivalentArmorItems(scenarioArmor);
    const armorBySlot = groupArmorBySlot(dedupedArmor);

    return {
        scenario,
        selectedArmor: dedupedArmor,
        armorBySlot,
        rawSlotProduct: rawSlotProduct(armorBySlot)
    };
}

function applySyntheticSets(armor: ArmorItem[], scenario: BenchmarkScenario) {
    if (!scenario.syntheticSets?.length) {
        return armor;
    }

    return armor.map((item) => {
        const syntheticSet = scenario.syntheticSets?.find((set) => set.slots.includes(item.slot) && !item.isExotic);

        return syntheticSet
            ? {
                  ...item,
                  set: {
                      id: syntheticSet.id,
                      name: syntheticSet.name
                  }
              }
            : item;
    });
}

export function groupArmorBySlot(armor: ArmorItem[]): ArmorInventoryBySlot {
    return {
        helmet: armor.filter((item) => item.slot === 'helmet'),
        arms: armor.filter((item) => item.slot === 'arms'),
        chest: armor.filter((item) => item.slot === 'chest'),
        legs: armor.filter((item) => item.slot === 'legs'),
        classItem: armor.filter((item) => item.slot === 'classItem')
    };
}

export function rawSlotProduct(armor: ArmorInventoryBySlot) {
    return ARMOR_SLOTS.reduce((product, slot) => product * armor[slot].length, 1);
}
