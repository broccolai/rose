import type { WeaponCatalog, WeaponDefinition, WeaponSelection, WeaponSocket, WeaponStat } from '@/features/weapons/types';

const CATALOG_PATH = '/data/weapon-catalog.json';
let catalogPromise: Promise<WeaponCatalog> | undefined;

export function loadWeaponCatalog() {
    catalogPromise ??= fetch(CATALOG_PATH)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Weapon catalog failed to load (${response.status}).`);
            }

            const catalog = (await response.json()) as WeaponCatalog;
            if (
                catalog.schemaVersion !== 1 ||
                !Array.isArray(catalog.weapons) ||
                !Array.isArray(catalog.plugSets) ||
                !catalog.statGroups ||
                typeof catalog.statGroups !== 'object'
            ) {
                throw new Error('Weapon catalog schema is not supported.');
            }
            return catalog;
        })
        .catch((error: unknown) => {
            catalogPromise = undefined;
            throw error;
        });
    return catalogPromise;
}

export function plugHashesForSocket(catalog: WeaponCatalog, socket: WeaponSocket) {
    return catalog.plugSets[socket.plugSet] ?? [];
}

export function createDefaultSelection(catalog: WeaponCatalog, weapon: WeaponDefinition): WeaponSelection {
    return {
        weaponHash: weapon.hash,
        plugs: Object.fromEntries(
            weapon.sockets.flatMap((socket) => {
                const hashes = plugHashesForSocket(catalog, socket);
                const selected = socket.initialPlugHash && hashes.includes(socket.initialPlugHash) ? socket.initialPlugHash : hashes[0];
                return selected ? [[String(socket.index), selected]] : [];
            })
        ),
        effects: {}
    };
}

export function reconcileSelection(catalog: WeaponCatalog, weapon: WeaponDefinition, selection: WeaponSelection) {
    const defaults = createDefaultSelection(catalog, weapon);
    const plugs = Object.fromEntries(
        weapon.sockets.flatMap((socket) => {
            const hashes = plugHashesForSocket(catalog, socket);
            const requested = selection.plugs[String(socket.index)];
            const selected = requested && hashes.includes(requested) ? requested : defaults.plugs[String(socket.index)];
            return selected ? [[String(socket.index), selected]] : [];
        })
    );
    const selectedHashes = new Set([...Object.values(plugs), ...(weapon.intrinsicHash === null ? [] : [weapon.intrinsicHash])]);
    const effects = Object.fromEntries(
        Object.entries(selection.effects).filter(
            ([hash, value]) => selectedHashes.has(Number(hash)) && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff
        )
    );
    return { weaponHash: weapon.hash, plugs, effects } satisfies WeaponSelection;
}

export function selectedPlugHashes(weapon: WeaponDefinition, selection: WeaponSelection) {
    return weapon.sockets.flatMap((socket) => {
        const hash = selection.plugs[String(socket.index)];
        return hash ? [hash] : [];
    });
}

export function calculateManifestStats(catalog: WeaponCatalog, weapon: WeaponDefinition, selection: WeaponSelection): WeaponStat[] {
    const statDeltas = new Map<number, number>();
    for (const hash of selectedPlugHashes(weapon, selection)) {
        const plug = catalog.plugs[String(hash)];
        if (!plug) continue;
        for (const [statHash, value] of Object.entries(plug.stats)) {
            const numericHash = Number(statHash);
            statDeltas.set(numericHash, (statDeltas.get(numericHash) ?? 0) + value);
        }
    }
    return weapon.stats.map((stat) => {
        const delta = statDeltas.get(stat.hash) ?? 0;
        const investmentValue = weapon.investmentStats?.[String(stat.hash)];
        return {
            ...stat,
            value:
                investmentValue === undefined
                    ? stat.value + delta
                    : transformWeaponStatValue(catalog, weapon, stat.hash, investmentValue + delta, stat.value + delta)
        };
    });
}

export function transformWeaponStatValue(
    catalog: WeaponCatalog,
    weapon: WeaponDefinition,
    statHash: number,
    investmentValue: number,
    fallbackValue: number
) {
    const curve = weapon.statGroupHash ? catalog.statGroups[String(weapon.statGroupHash)]?.scaledStats[String(statHash)] : undefined;
    const points = curve?.displayInterpolation;
    if (!curve || !points || points.length === 0) return fallbackValue;
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return fallbackValue;
    if (investmentValue <= first[0]) return first[1];
    for (let index = 1; index < points.length; index += 1) {
        const lower = points[index - 1];
        const upper = points[index];
        if (!lower || !upper || investmentValue > upper[0]) continue;
        const span = upper[0] - lower[0];
        const progress = span === 0 ? 0 : (investmentValue - lower[0]) / span;
        return Math.round(lower[1] + (upper[1] - lower[1]) * progress);
    }
    return last[1];
}

export function bungieAssetUrl(path: string) {
    return path ? `https://www.bungie.net${path}` : '';
}
