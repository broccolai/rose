import {
    ARMOR_SLOTS,
    type ArmorInventoryBySlot,
    type ArmorItem,
    createDefaultStatModOptions,
    createTierFiveTuningOptions,
    dedupeEquivalentArmorItems,
    NO_TUNING
} from '../../armor-calc/src';
import type { BenchmarkScenario, LoadedBenchmarkBundle, PreparedScenario } from './types';

export function prepareScenario(bundle: LoadedBenchmarkBundle, scenario: BenchmarkScenario): PreparedScenario {
    const armor = bundle.normalizedProfile?.armor ?? [];
    const compatibleArmor = armor.filter((item) => item.classType === 'any' || item.classType === scenario.classType);
    const synthesizeModernOptions =
        scenario.synthesizeModernOptions === true && !compatibleArmor.some((item) => item.tuningOptions.length > 1);
    const syntheticTuningItemIds = selectSyntheticTuningItemIds(compatibleArmor, scenario, synthesizeModernOptions);
    const classArmor = compatibleArmor.map((item) =>
        prepareBenchmarkItem(item, scenario, synthesizeModernOptions, syntheticTuningItemIds.has(item.itemInstanceId))
    );
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
        rawSlotProduct: rawSlotProduct(armorBySlot),
        tunableItemCount: dedupedArmor.filter((item) => item.tuningOptions.length > 1).length
    };
}

function prepareBenchmarkItem(
    item: ArmorItem,
    scenario: BenchmarkScenario,
    synthesizeModernOptions: boolean,
    synthesizeTuning: boolean
): ArmorItem {
    const modernItem = synthesizeModernOptions
        ? {
              ...item,
              tier: synthesizeTuning ? (5 as const) : item.tier,
              statModOptions: createDefaultStatModOptions(),
              tuningOptions: synthesizeTuning ? createTierFiveTuningOptions({ ...item, tier: 5 }) : [NO_TUNING]
          }
        : { ...item };

    return scenario.disableTuning ? { ...modernItem, tuningOptions: [NO_TUNING] } : modernItem;
}

function selectSyntheticTuningItemIds(armor: ArmorItem[], scenario: BenchmarkScenario, synthesizeModernOptions: boolean): Set<string> {
    if (!synthesizeModernOptions) {
        return new Set();
    }

    const itemsPerSlot = Math.max(0, Math.trunc(scenario.syntheticTuningItemsPerSlot ?? 6));
    const selected = new Set(
        ARMOR_SLOTS.flatMap((slot) =>
            armor
                .filter((item) => item.slot === slot && !item.isExotic)
                .slice(0, itemsPerSlot)
                .map((item) => item.itemInstanceId)
        )
    );

    for (const item of armor) {
        if (item.isExotic && item.itemHash === scenario.selectedExoticItemHash) {
            selected.add(item.itemInstanceId);
        }
    }

    return selected;
}

function applySyntheticSets(armor: ArmorItem[], scenario: BenchmarkScenario) {
    if (!scenario.syntheticSets?.length) {
        return armor;
    }

    const selectedIdsBySet = new Map(
        scenario.syntheticSets.map((set) => {
            const selectedIds = new Set(
                set.slots.flatMap((slot) =>
                    armor
                        .filter((item) => item.slot === slot && !item.isExotic)
                        .slice(0, set.itemsPerSlot)
                        .map((item) => item.itemInstanceId)
                )
            );

            return [set.id, selectedIds] as const;
        })
    );

    return armor.map((item) => {
        const syntheticSet = scenario.syntheticSets?.find(
            (set) => set.slots.includes(item.slot) && !item.isExotic && selectedIdsBySet.get(set.id)?.has(item.itemInstanceId)
        );

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
