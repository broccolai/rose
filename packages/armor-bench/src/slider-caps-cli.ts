import { ARMOR_STATS, type ArmorStat, type StatVector } from '@rose/armor-domain';
import { groupArmorBySlot, rawSlotProduct } from './armor';
import { loadLatestBenchmarkBundle } from './bundle';
import { BenchmarkArmorEngine } from './wasm-engine';

const profile = loadLatestBenchmarkBundle().normalizedProfile;
if (!profile?.armor) {
    throw new Error('Benchmark bundle does not include normalized armor.');
}

const warlockArmor = profile.armor.filter((item) => item.classType === 'any' || item.classType === 'warlock');
const input = {
    characterId: 'warlock',
    classType: 'warlock' as const,
    dumpStat: 'health' as ArmorStat,
    allowBalancedTuning: false,
    statTargets: {
        health: 0,
        melee: 0,
        grenade: 200,
        super: 0,
        class: 0,
        weapons: 170
    } satisfies StatVector,
    statBonuses: undefined,
    setRequirements: [],
    armor: groupArmorBySlot(warlockArmor)
};

const measure = <T>(label: string, run: () => T): T => {
    const start = performance.now();
    const value = run();
    const elapsedMs = performance.now() - start;
    console.log(`${label}: ${elapsedMs.toFixed(2)}ms`);
    return value;
};

console.log(`Warlock armor: ${warlockArmor.length}`);
console.log(`Raw slot product: ${rawSlotProduct(input.armor).toLocaleString()}`);

const engine = new BenchmarkArmorEngine(input.armor);

try {
    if (process.env['ROSE_CAP_BENCH_SORTED_SOLVE'] === '1') {
        const sortedSolveCap = measure('priority grenade cap via sorted solve', () =>
            engine.solve({
                ...input,
                statTargets: {
                    ...input.statTargets,
                    grenade: 0
                },
                resultSort: { key: 'grenade', direction: 'desc' },
                maxResults: 1,
                stopWhenResultLimitReached: false
            })
        );
        console.log(
            `sorted solve result: ${
                sortedSolveCap.ok
                    ? JSON.stringify({
                          grenade: sortedSolveCap.builds[0]?.stats.grenade,
                          searched: sortedSolveCap.searchedCombinations,
                          valid: sortedSolveCap.validBuildCount
                      })
                    : sortedSolveCap.reason
            }`
        );
    } else {
        console.log('priority grenade cap via sorted solve: skipped; set ROSE_CAP_BENCH_SORTED_SOLVE=1 to run the known-slow experiment');
    }

    if (process.env['ROSE_CAP_BENCH_SLOW'] !== '0') {
        const priority = measure('priority grenade cap', () => engine.calculateCap(input, 'grenade'));
        console.log(`priority grenade cap result: ${priority}`);
    } else {
        console.log('priority grenade cap: skipped');
    }

    const individualCaps = measure(
        'all caps via individual calls',
        () => Object.fromEntries(ARMOR_STATS.map((stat) => [stat, engine.calculateCap(input, stat)])) as StatVector
    );
    console.log(`individual caps: ${JSON.stringify(individualCaps)}`);

    const batchCaps = measure('all caps via calculateCaps', () => engine.calculateCaps(input));
    console.log(`batch caps: ${JSON.stringify(batchCaps)}`);
} finally {
    engine.dispose();
}
