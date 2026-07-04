import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import type { ArmorItem, ArmorSlot } from '../../armor-calc/src';
import { d2apSourceMapPath } from './bundle';
import type { BenchmarkScenario, D2APBenchmarkResult } from './types';
import { d2apStatOrder as statOrder } from './types';

declare const Bun: {
    Transpiler: new (options: {
        loader: 'ts';
    }) => {
        transformSync(source: string): string;
    };
};

const slotIds: Record<ArmorSlot, number> = {
    helmet: 1,
    arms: 2,
    chest: 3,
    legs: 4,
    classItem: 5
};

const classIds = {
    titan: 0,
    hunter: 1,
    warlock: 2
} as const;

type D2APRunner = (data: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;

type D2APDoneStats = {
    computedPermutations?: number;
    savedResults?: number;
    totalTime?: number;
};

export function createD2APBenchmarkAdapter() {
    const d2apRunner = createD2APRunner();

    return {
        async runScenario(items: ArmorItem[], scenario: BenchmarkScenario): Promise<D2APBenchmarkResult> {
            const start = performance.now();
            const messages = await d2apRunner({
                type: 'builderRequest',
                threadSplit: { count: 1, current: 0 },
                items: items.map(toD2APItem),
                config: createD2APConfig(scenario)
            });
            const elapsedMs = performance.now() - start;
            const doneMessage = [...messages].reverse().find((message) => message.done);
            const stats = doneMessage?.stats as D2APDoneStats | undefined;

            return {
                elapsedMs,
                checkedCalculations: Number(doneMessage?.checkedCalculations ?? 0),
                computedPermutations: stats?.computedPermutations ?? 0,
                savedResults: stats?.savedResults ?? 0,
                workerReportedMs: stats?.totalTime ?? 0
            };
        }
    };
}

function toD2APItem(item: ArmorItem, index: number) {
    return {
        id: index,
        hash: item.itemHash,
        slot: slotIds[item.slot],
        masterworkLevel: 0,
        archetypeStats: inferD2APArchetypeStats(item),
        tier: item.tier ?? 5,
        gearSetHash: item.set ? hashString(item.set.id) : null,
        mobility: item.baseStats.weapons,
        resilience: item.baseStats.health,
        recovery: item.baseStats.class,
        discipline: item.baseStats.grenade,
        intellect: item.baseStats.super,
        strength: item.baseStats.melee,
        source: 0,
        armorSystem: 3,
        perk: -1,
        isExotic: item.isExotic ? 1 : 0,
        tuningStat: inferD2APTuningStat(item),
        exoticPerkHash: []
    };
}

function inferD2APTuningStat(item: ArmorItem) {
    const pairTuning = item.tuningOptions.find((option) => {
        const values = statOrder.map((stat) => option.deltas[stat] ?? 0);

        return values.some((value) => value === 5) && values.some((value) => value === -5);
    });

    if (!pairTuning) {
        return undefined;
    }

    return statOrder.findIndex((stat) => pairTuning.deltas[stat] === 5);
}

function inferD2APArchetypeStats(item: ArmorItem) {
    return [...statOrder]
        .sort((left, right) => item.baseStats[right] - item.baseStats[left])
        .slice(0, 3)
        .map((stat) => statOrder.indexOf(stat));
}

function createD2APConfig(scenario: BenchmarkScenario) {
    return {
        characterClass: classIds[scenario.classType],
        addConstent1Health: false,
        assumeClassItemIsArtifice: false,
        assumeEveryLegendaryIsArtifice: false,
        assumeEveryExoticIsArtifice: false,
        disabledItems: [],
        minimumStatTiers: Object.fromEntries(
            statOrder.map((stat, index) => [index, { fixed: false, value: (scenario.targets[stat] ?? 0) / 10 }])
        ),
        statModLimits: { maxMods: 5, maxMajorMods: 5 },
        calculateTierFiveTuning: !scenario.disableTuning,
        putArtificeMods: false,
        useFotlArmor: false,
        allowBlueArmorPieces: true,
        allowLegacyLegendaryArmor: false,
        allowLegacyExoticArmor: false,
        enforceFeaturedLegendaryArmor: false,
        enforceFeaturedExoticArmor: false,
        ignoreSunsetArmor: false,
        includeVendorRolls: false,
        includeCollectionRolls: false,
        assumeLegendariesMasterworked: false,
        assumeExoticsMasterworked: false,
        onlyUseMasterworkedExotics: false,
        onlyUseMasterworkedLegendaries: false,
        modOptimizationStrategy: 0,
        limitParsedResults: true,
        earlyAbortClassItems: true,
        tryLimitWastedStats: false,
        onlyShowResultsWithNoWastedStats: false,
        selectedModElement: 4,
        armorRequirements: (scenario.setRequirements ?? []).flatMap((requirement) =>
            Array.from({ length: requirement.requiredPieces }, () => ({ gearSetHash: hashString(requirement.setId) }))
        ),
        enabledMods: [],
        selectedExotics: scenario.selectedExoticItemHash ? [scenario.selectedExoticItemHash] : [],
        selectedExoticPerks: [0, 0]
    };
}

function createD2APRunner(): D2APRunner {
    const sourceMap = JSON.parse(readFileSync(d2apSourceMapPath, 'utf8')) as {
        sources: string[];
        sourcesContent: string[];
    };
    const workerSource = readSource(sourceMap, './src/app/services/results-builder.worker.ts');
    const precalcSource = readSource(sourceMap, './src/app/data/generated/precalculatedModCombinationsWithTunings.ts');
    const precalcLiteral = precalcSource.match(/=\s*(\{[\s\S]*\});\s*$/)?.[1];

    if (!precalcLiteral) {
        throw new Error('Could not extract D2ArmorPicker tuning/mod precalculation table.');
    }

    const patchedWorkerSource = workerSource.replace(/import[\s\S]*?;\n/g, '').replaceAll('export ', '');
    const harnessSource = `
const console = { log() {}, warn() {}, time() {}, timeEnd() {} };
const environment = { production: false, featureFlags: { enableZeroWaste: false, enableModslotLimitation: true } };
const MAXIMUM_MASTERWORK_LEVEL = 5;
const FORCE_USE_NO_EXOTIC = -1;
const FORCE_USE_ANY_EXOTIC = -2;
const ArmorSystem = { Armor1: 1, Armor2: 2, Armor3: 3 };
const ArmorSlot = { ArmorSlotNone: 0, ArmorSlotHelmet: 1, ArmorSlotGauntlet: 2, ArmorSlotChest: 3, ArmorSlotLegs: 4, ArmorSlotClass: 5 };
const ArmorStat = { StatWeapon: 0, StatHealth: 1, StatClass: 2, StatGrenade: 3, StatSuper: 4, StatMelee: 5 };
const ArmorPerkOrSlot = { None: -1, Any: 0, SlotArtifice: 10 };
const ArmorPerkSocketHashes = {};
const SpecialArmorStat = { ClassAbilityRegenerationStat: 10 };
const ModInformation = {};
const STAT_MOD_VALUES = {
  0: [5, 0, 0, 0],
  1: [0, 5, 1, 1703647492], 2: [0, 10, 3, 4183296050], 3: [0, 3, 0, 2322202118],
  4: [1, 5, 1, 2532323436], 5: [1, 10, 3, 1180408010], 6: [1, 3, 0, 199176566],
  7: [2, 5, 1, 1237786518], 8: [2, 10, 3, 4204488676], 9: [2, 3, 0, 539459624],
  10: [3, 5, 1, 4021790309], 11: [3, 10, 3, 1435557120], 12: [3, 3, 0, 617569843],
  13: [4, 5, 1, 350061697], 14: [4, 10, 3, 2724608735], 15: [4, 3, 0, 3160845295],
  16: [5, 5, 1, 2639422088], 17: [5, 10, 3, 4287799666], 18: [5, 3, 0, 2507624050]
};
const precalculatedTuningModCombinations = ${precalcLiteral};
function createArmorSet(helmet, gauntlet, chest, leg, classItem, usedArtifice, usedMods, statsWithMods, statsWithoutMods, tuning) {
  return { armor: [helmet.id, gauntlet.id, chest.id, leg.id, classItem.id], useExoticClassItem: false, usedArtifice, usedMods, statsWithMods, statsWithoutMods, tuning };
}
let __d2apHandler;
const __d2apMessages = [];
globalThis.addEventListener = (type, callback) => {
  if (type === 'message') __d2apHandler = callback;
};
globalThis.postMessage = (message) => {
  __d2apMessages.push(message);
};
${patchedWorkerSource}
globalThis.__runD2APBenchmark = async (data) => {
  __d2apMessages.length = 0;
  await __d2apHandler({ data });
  return [...__d2apMessages];
};
`;
    const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(harnessSource);
    const factory = new Function(`${js}; return globalThis.__runD2APBenchmark;`);

    return factory() as D2APRunner;
}

function readSource(sourceMap: { sources: string[]; sourcesContent: string[] }, sourcePath: string) {
    const index = sourceMap.sources.indexOf(sourcePath);

    if (index === -1) {
        throw new Error(`Missing D2ArmorPicker source ${sourcePath} in ${d2apSourceMapPath}.`);
    }

    return sourceMap.sourcesContent[index];
}

function hashString(value: string) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}
