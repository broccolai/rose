import type { WeaponCatalog, WeaponDefinition, WeaponPlug, WeaponPlugChoice, WeaponSelection, WeaponSocket, WeaponStat } from './types';

export const plugHashesForSocket = (catalog: WeaponCatalog, socket: WeaponSocket): number[] => {
    return catalog.plugSets[socket.plugSet] ?? [];
};

export const isEnhancedPlug = (plug: WeaponPlug): boolean => {
    return plug.enhanced || /^Enhanced(?:\s|$)/i.test(plug.label);
};

export const plugChoicesForSocket = (catalog: WeaponCatalog, socket: WeaponSocket): WeaponPlugChoice[] => {
    const hashes = plugHashesForSocket(catalog, socket);
    const families = new Map<string, number[]>();

    for (const hash of hashes) {
        const plug = catalog.plugs[String(hash)];
        const family = plug?.name.trim().toLocaleLowerCase() || `#${hash}`;
        const members = families.get(family) ?? [];
        members.push(hash);
        families.set(family, members);
    }

    return [...families.values()].flatMap((members): WeaponPlugChoice[] => {
        const enhancedMembers = members.filter((hash) => {
            const plug = catalog.plugs[String(hash)];
            return plug ? isEnhancedPlug(plug) : false;
        });
        if (enhancedMembers.length === 0) {
            return members.map((hash) => ({ hash, hashes: [hash], enhanced: false }));
        }

        const initialEnhancedHash = enhancedMembers.find((hash) => hash === socket.initialPlugHash);
        const selectedHash = initialEnhancedHash ?? enhancedMembers[0];
        return selectedHash === undefined ? [] : [{ hash: selectedHash, hashes: members, enhanced: true }];
    });
};

export const createDefaultSelection = (catalog: WeaponCatalog, weapon: WeaponDefinition): WeaponSelection => {
    return {
        weaponHash: weapon.hash,
        plugs: Object.fromEntries(
            weapon.sockets.flatMap((socket) => {
                const choices = plugChoicesForSocket(catalog, socket);
                const initialChoice = choices.find((choice) =>
                    socket.initialPlugHash === null ? false : choice.hashes.includes(socket.initialPlugHash)
                );
                const selected = initialChoice?.hash ?? choices[0]?.hash;
                return selected ? [[String(socket.index), selected]] : [];
            })
        ),
        effects: {}
    };
};

export const reconcileSelection = (catalog: WeaponCatalog, weapon: WeaponDefinition, selection: WeaponSelection): WeaponSelection => {
    const defaults = createDefaultSelection(catalog, weapon);
    const canonicalHashes = new Map<number, number>();
    const plugs = Object.fromEntries(
        weapon.sockets.flatMap((socket) => {
            const choices = plugChoicesForSocket(catalog, socket);
            for (const choice of choices) {
                for (const hash of choice.hashes) canonicalHashes.set(hash, choice.hash);
            }
            const requested = selection.plugs[String(socket.index)];
            const selected = requested ? choices.find((choice) => choice.hashes.includes(requested))?.hash : undefined;
            return selected ? [[String(socket.index), selected]] : [];
        })
    );
    for (const [socketIndex, hash] of Object.entries(defaults.plugs)) {
        plugs[socketIndex] ??= hash;
    }
    const selectedHashes = new Set([...Object.values(plugs), ...(weapon.intrinsicHash === null ? [] : [weapon.intrinsicHash])]);
    const effects: Record<string, number> = {};
    for (const [hash, value] of Object.entries(selection.effects)) {
        const canonicalHash = canonicalHashes.get(Number(hash)) ?? Number(hash);
        if (selectedHashes.has(canonicalHash) && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff) {
            effects[String(canonicalHash)] = value;
        }
    }
    return { weaponHash: weapon.hash, plugs, effects } satisfies WeaponSelection;
};

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
