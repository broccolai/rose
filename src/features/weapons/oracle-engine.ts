import { weaponsStatDamageScalar } from '@/features/weapons/calculations';
import { calculateManifestStats, selectedPlugHashes, transformWeaponStatValue } from '@/features/weapons/catalog';
import type {
    WeaponCatalog,
    WeaponDefinition,
    WeaponEffectOption,
    WeaponEngineCalculation,
    WeaponMode,
    WeaponSelection,
    WeaponTtkKill,
    WeaponTtkSummary
} from '@/features/weapons/types';

type EngineModule = typeof import('@/features/weapons/wasm/generated/rose_weapon_engine');

export type WeaponCalculationInput = {
    catalog: WeaponCatalog;
    weapon: WeaponDefinition;
    selection: WeaponSelection;
    mode: WeaponMode;
    targetHealth: number;
    overshield: number;
    weaponsStat: number;
};

let enginePromise: Promise<EngineModule> | undefined;

export async function calculateWeapon(input: WeaponCalculationInput): Promise<WeaponEngineCalculation> {
    const api = await loadEngine();
    const { catalog, weapon, selection } = input;
    const configured = api.setWeapon(
        weapon.hash,
        weapon.subtype,
        weapon.intrinsicHash ?? 0,
        ammoTypeId(weapon.ammo),
        damageTypeHash(weapon.element)
    );
    const metadata = api.getMetadata();
    const engineVersion = metadata.apiVersion;
    metadata.free();

    const manifestStats = calculateManifestStats(catalog, weapon, selection);
    if (!configured) {
        return unavailableCalculation(manifestStats, engineVersion);
    }

    const investmentStats = Object.entries(weapon.investmentStats ?? {});
    api.setStats(
        new Map(
            investmentStats.length > 0
                ? investmentStats.map(([hash, value]) => [Number(hash), value])
                : weapon.stats.map((stat) => [stat.hash, stat.value])
        )
    );
    const plugHashes = selectedPlugHashes(weapon, selection);
    const optionHashes = [...(weapon.intrinsicHash ? [weapon.intrinsicHash] : []), ...plugHashes];
    const effectOptions = normalizeWeaponEffectOptions(api.getTraitOptions(Uint32Array.from(optionHashes)));
    for (const hash of plugHashes) {
        const plug = catalog.plugs[String(hash)];
        if (plug) {
            api.addTrait(
                new Map(Object.entries(plug.stats).map(([statHash, value]) => [Number(statHash), value])),
                clampWeaponEffectValue(effectOptions[String(hash)], selection.effects[String(hash)] ?? 0),
                hash
            );
        }
    }
    if (weapon.intrinsicHash) {
        api.setTraitValue(
            weapon.intrinsicHash,
            clampWeaponEffectValue(effectOptions[String(weapon.intrinsicHash)], selection.effects[String(weapon.intrinsicHash)] ?? 0)
        );
    }

    const unsupportedTraitHashes = weapon.sockets
        .filter((socket) => /trait|origin|catalyst|mod/i.test(socket.label))
        .map((socket) => selection.plugs[String(socket.index)])
        .filter((hash): hash is number => Boolean(hash) && !api.isTraitSupported(hash));
    const partiallyModeledTraitHashes = [...new Set(optionHashes.filter((hash) => Boolean(effectOptions[String(hash)]?.modelingNote)))];
    const pvp = input.mode === 'pvp';
    const damageScalar = weaponsStatDamageScalar(input.weaponsStat);

    const rangeResponse = api.getWeaponRangeFalloff(true, pvp);
    const range = {
        hipStart: rangeResponse.hipFalloffStart,
        hipEnd: rangeResponse.hipFalloffEnd,
        adsStart: rangeResponse.adsFalloffStart,
        adsEnd: rangeResponse.adsFalloffEnd,
        floorPercent: rangeResponse.floorPercent
    };
    rangeResponse.free();

    const handlingResponse = api.getWeaponHandlingTimes(true, pvp);
    const handling = {
        ready: handlingResponse.readyTime,
        stow: handlingResponse.stowTime,
        ads: handlingResponse.adsTime
    };
    handlingResponse.free();

    const reloadResponse = api.getWeaponReloadTimes(true, pvp);
    const reload = {
        reload: reloadResponse.reloadTime,
        ammo: reloadResponse.ammoTime
    };
    reloadResponse.free();

    const ammoResponse = api.getWeaponAmmoSizes(true, pvp);
    const ammo = {
        magazine: ammoResponse.magSize,
        reserves: ammoResponse.reserveSize
    };
    ammoResponse.free();

    const firingResponse = api.getWeaponFiringData(true, pvp, false);
    const impactDamage = pvp ? firingResponse.pvpImpactDamage : firingResponse.pveImpactDamage;
    const explosionDamage = pvp ? firingResponse.pvpExplosionDamage : firingResponse.pveExplosionDamage;
    const rawCritMultiplier = pvp ? firingResponse.pvpCritMult : firingResponse.pveCritMult;
    const critMultiplier = weapon.type === 'Shotgun' && firingResponse.burstSize === 12 ? 1 : rawCritMultiplier;
    const displayedDamageScalar = pvp ? damageScalar : 1;
    const rawFiring = {
        bodyDamage: (impactDamage + explosionDamage) * displayedDamageScalar,
        critDamage: (impactDamage * critMultiplier + explosionDamage) * displayedDamageScalar,
        rpm: firingResponse.rpm,
        burstSize: firingResponse.burstSize
    };
    firingResponse.free();

    const rawTtk = pvp ? (api.getWeaponTtkAtHealth(input.targetHealth, input.overshield, damageScalar) as WeaponTtkSummary) : null;
    const firing = normalizeFiring(rawFiring);
    const ttk = firing && rawTtk ? normalizeTtk(rawTtk) : null;
    const engineStats = normalizeEngineStats(api.getStats());
    // Oracle calculates from raw investment stats; the stat sheet presents Bungie's transformed values.
    const manifestStatsByHash = new Map(manifestStats.map((stat) => [stat.hash, stat.value]));
    const stats = weapon.stats.map((stat) => {
        const calculated = engineStats.get(stat.hash);
        const baseValue = stat.value;
        const rawBase = Number(weapon.investmentStats?.[String(stat.hash)] ?? calculated?.baseValue ?? 0);
        const rawPart = calculated?.partValue ?? 0;
        const rawTrait = calculated?.traitValue ?? 0;
        const withParts = calculated
            ? transformWeaponStatValue(catalog, weapon, stat.hash, rawBase + rawPart, manifestStatsByHash.get(stat.hash) ?? stat.value)
            : (manifestStatsByHash.get(stat.hash) ?? stat.value);
        const total = calculated
            ? transformWeaponStatValue(catalog, weapon, stat.hash, rawBase + rawPart + rawTrait, withParts + rawTrait)
            : withParts;
        const partValue = withParts - baseValue;
        const traitValue = total - withParts;
        return {
            ...stat,
            baseValue,
            partValue,
            traitValue,
            total,
            value: total
        };
    });

    return {
        coverage:
            !firing || (pvp && !ttk)
                ? 'unavailable'
                : unsupportedTraitHashes.length > 0 || partiallyModeledTraitHashes.length > 0
                  ? 'partial'
                  : 'full',
        engineVersion,
        unsupportedTraitHashes,
        partiallyModeledTraitHashes,
        effectOptions,
        stats,
        range,
        handling,
        reload,
        ammo,
        firing,
        ttk
    };
}

async function loadEngine() {
    enginePromise ??= import('@/features/weapons/wasm/generated/rose_weapon_engine')
        .then(async (module) => {
            await module.default();
            module.setLoggingLevel(0);
            return module;
        })
        .catch((error: unknown) => {
            enginePromise = undefined;
            throw error;
        });
    return enginePromise;
}

export function clampWeaponEffectValue(option: WeaponEffectOption | undefined, value: number) {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
    if (!option || option.optionType === 'STATIC') return 0;
    if (option.optionType === 'TOGGLE') return normalized > 0 ? 1 : 0;
    if (option.optionType === 'OPTIONS') return Math.max(0, Math.min(Math.max(0, option.options.length - 1), normalized));
    return Math.max(option.stacks[0], Math.min(option.stacks[1], normalized));
}

function unavailableCalculation(stats: ReturnType<typeof calculateManifestStats>, engineVersion: string): WeaponEngineCalculation {
    return {
        coverage: 'unavailable',
        engineVersion,
        unsupportedTraitHashes: [],
        partiallyModeledTraitHashes: [],
        effectOptions: {},
        stats: stats.map((stat) => ({ ...stat, baseValue: stat.value, partValue: 0, traitValue: 0, total: stat.value })),
        range: null,
        handling: null,
        reload: null,
        ammo: null,
        firing: null,
        ttk: null
    };
}

export function normalizeWeaponEffectOptions(value: unknown) {
    const entries = value instanceof Map ? [...value.entries()] : Object.entries((value ?? {}) as Record<string, unknown>);
    return Object.fromEntries(
        entries.flatMap(([hash, option]) => {
            if (!option || typeof option !== 'object') return [];
            const candidate = option as Partial<WeaponEffectOption>;
            if (!Array.isArray(candidate.stacks) || !isEffectOptionType(candidate.optionType)) return [];
            const minimum = finiteInteger(candidate.stacks[0], 0);
            const maximum = Math.max(minimum, finiteInteger(candidate.stacks[1], minimum));
            return [
                [
                    String(hash),
                    {
                        stacks: [minimum, maximum],
                        options: Array.isArray(candidate.options) ? candidate.options.map(String) : [],
                        optionType: candidate.optionType,
                        ...(typeof candidate.modelingNote === 'string' && candidate.modelingNote.trim()
                            ? { modelingNote: candidate.modelingNote.trim() }
                            : {})
                    } satisfies WeaponEffectOption
                ]
            ];
        })
    );
}

function normalizeFiring(firing: WeaponEngineCalculation['firing']) {
    if (
        !firing ||
        !Number.isFinite(firing.bodyDamage) ||
        firing.bodyDamage <= 0 ||
        !Number.isFinite(firing.critDamage) ||
        firing.critDamage < firing.bodyDamage
    ) {
        return null;
    }
    return {
        ...firing,
        rpm: Number.isFinite(firing.rpm) && firing.rpm > 0 ? firing.rpm : 0,
        burstSize: Number.isFinite(firing.burstSize) && firing.burstSize >= 1 ? Math.round(firing.burstSize) : 1
    };
}

function normalizeTtk(value: WeaponTtkSummary) {
    const bodyTtk = isValidKill(value.bodyTtk) ? value.bodyTtk : null;
    const optimalTtk = isValidKill(value.optimalTtk) ? value.optimalTtk : null;
    return bodyTtk || optimalTtk ? { ...value, bodyTtk, optimalTtk } : null;
}

function isValidKill(value: WeaponTtkSummary['bodyTtk']): value is WeaponTtkKill {
    const bodyshots = Number(value?.bodyshots ?? 0);
    const headshots = Number(value?.headshots ?? 0);
    const timeTaken = value?.timeTaken;
    const totalShots = bodyshots + headshots;
    return (
        Number.isInteger(bodyshots) &&
        bodyshots >= 0 &&
        Number.isInteger(headshots) &&
        headshots >= 0 &&
        totalShots >= 1 &&
        totalShots < 50 &&
        typeof timeTaken === 'number' &&
        Number.isFinite(timeTaken) &&
        timeTaken >= 0
    );
}

function isEffectOptionType(value: unknown): value is WeaponEffectOption['optionType'] {
    return value === 'STATIC' || value === 'TOGGLE' || value === 'SLIDER' || value === 'OPTIONS';
}

function finiteInteger(value: unknown, fallback: number) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function normalizeEngineStats(value: unknown) {
    const entries = value instanceof Map ? [...value.entries()] : Object.entries((value ?? {}) as Record<string, unknown>);
    return new Map(
        entries.flatMap(([hash, stat]) => {
            if (!stat || typeof stat !== 'object') return [];
            const value = stat as { baseValue?: unknown; partValue?: unknown; traitValue?: unknown };
            return [
                [
                    Number(hash),
                    {
                        baseValue: Number(value.baseValue) || 0,
                        partValue: Number(value.partValue) || 0,
                        traitValue: Number(value.traitValue) || 0
                    }
                ] as const
            ];
        })
    );
}

function ammoTypeId(ammo: WeaponDefinition['ammo']) {
    return ammo === 'primary' ? 1 : ammo === 'special' ? 2 : ammo === 'heavy' ? 3 : 0;
}

function damageTypeHash(element: WeaponDefinition['element']) {
    const hashes = {
        kinetic: 3373582085,
        arc: 2303181850,
        solar: 1847026933,
        void: 3454344768,
        stasis: 151347233,
        strand: 3949783978,
        unknown: 0
    } as const;
    return hashes[element];
}
