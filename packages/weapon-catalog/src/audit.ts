import { calculateWeapon, createDefaultSelection, type WeaponCatalog, type WeaponEngineCalculation } from '@rose/weapon-model';

type CoverageCounts = Record<WeaponEngineCalculation['coverage'] | 'error', number>;

const catalog = (await Bun.file(new URL('../../../public/data/weapon-catalog.json', import.meta.url)).json()) as WeaponCatalog;
const totals = emptyCounts();
const byType = new Map<string, CoverageCounts>();
const failures: Array<{ hash: number; name: string; issue: string }> = [];
const originalConsole = { log: console.log, warn: console.warn, error: console.error };

console.log = () => {};
console.warn = () => {};
console.error = () => {};

try {
    for (const weapon of catalog.weapons) {
        const typeCounts = byType.get(weapon.type) ?? emptyCounts();
        byType.set(weapon.type, typeCounts);

        try {
            const selection = createDefaultSelection(catalog, weapon);
            const input = {
                catalog,
                weapon,
                selection,
                targetHealth: 230,
                overshield: 0,
                weaponsStat: 100
            } as const;
            const pvp = await calculateWeapon({ ...input, mode: 'pvp' });
            const pve = await calculateWeapon({ ...input, mode: 'pve' });
            totals[pvp.coverage] += 1;
            typeCounts[pvp.coverage] += 1;

            const issue = calculationIssue(pvp, pve);
            if (issue) failures.push({ hash: weapon.hash, name: weapon.name, issue });
        } catch (error: unknown) {
            totals.error += 1;
            typeCounts.error += 1;
            failures.push({ hash: weapon.hash, name: weapon.name, issue: error instanceof Error ? error.message : String(error) });
        }
    }
} finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
}

const available = totals.full + totals.partial;
const engine = await import('@rose/weapon-engine/wasm');
const plugHashes = Object.keys(catalog.plugs).map(Number);
const implementedPlugs = plugHashes.filter((hash) => engine.isTraitSupported(hash)).length;
const effectOptions = engine.getTraitOptions(Uint32Array.from(plugHashes)) as Map<number, { optionType: string }>;
const interactiveEffects = [...effectOptions.values()].filter((option) => option.optionType !== 'STATIC').length;

const report = {
    catalog: {
        manifestVersion: catalog.manifestVersion,
        weapons: catalog.weapons.length,
        plugs: plugHashes.length
    },
    coverage: {
        ...totals,
        available,
        availablePercent: Number(((available / catalog.weapons.length) * 100).toFixed(1))
    },
    traits: {
        implementedPlugs,
        interactiveEffects
    },
    byType: Object.fromEntries([...byType.entries()].sort(([left], [right]) => left.localeCompare(right))),
    failures: failures.slice(0, 50)
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0 || totals.error > 0 || available < 1900) {
    throw new Error(`Weapon engine audit failed with ${failures.length} invariant failure(s) and ${available} available weapons.`);
}

function emptyCounts(): CoverageCounts {
    return { full: 0, partial: 0, unavailable: 0, error: 0 };
}

function calculationIssue(pvp: WeaponEngineCalculation, pve: WeaponEngineCalculation) {
    if (pvp.coverage !== pve.coverage) return `PvP coverage ${pvp.coverage} differs from PvE coverage ${pve.coverage}`;
    if (pve.ttk !== null) return 'PvE calculation exposed a PvP TTK result';
    if (!validStats(pvp) || !validStats(pve)) return 'Calculation returned a non-finite stat';
    if (pvp.coverage === 'unavailable') return null;
    if (!pvp.firing || !pvp.ttk) return 'Available PvP calculation is missing firing or TTK data';
    if (!pve.firing) return 'Available PvE calculation is missing firing data';
    if (pvp.firing.bodyDamage <= 0 || pvp.firing.critDamage < pvp.firing.bodyDamage) return 'PvP damage profile is invalid';
    if (pve.firing.bodyDamage <= 0 || pve.firing.critDamage < pve.firing.bodyDamage) return 'PvE damage profile is invalid';
    return null;
}

function validStats(calculation: WeaponEngineCalculation) {
    return calculation.stats.every((stat) => Number.isFinite(stat.total));
}
