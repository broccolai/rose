import type { SavedWeaponRoll, WeaponScenario, WeaponSelection } from '@rose/weapon-model';
import { DEFAULT_WEAPON_SCENARIO } from '@/features/weapons/selection-url';

export const WEAPON_COMPARE_KEY = 'rose.weapon-compare.v1';
export const MAX_COMPARE_ROLLS = 6;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function readWeaponCompare(storage = getStorage()): SavedWeaponRoll[] {
    if (!storage) return [];
    try {
        const value = JSON.parse(storage.getItem(WEAPON_COMPARE_KEY) ?? '[]');
        return Array.isArray(value) ? value.flatMap(sanitizeSavedWeaponRoll).slice(0, MAX_COMPARE_ROLLS) : [];
    } catch {
        return [];
    }
}

export function writeWeaponCompare(rolls: SavedWeaponRoll[], storage = getStorage()) {
    if (!storage) return true;
    try {
        storage.setItem(WEAPON_COMPARE_KEY, JSON.stringify(rolls.slice(0, MAX_COMPARE_ROLLS)));
        return true;
    } catch {
        return false;
    }
}

export function addWeaponCompare(current: SavedWeaponRoll[], roll: SavedWeaponRoll) {
    return [roll, ...current.filter((candidate) => candidate.id !== roll.id)].slice(0, MAX_COMPARE_ROLLS);
}

function sanitizeSavedWeaponRoll(value: unknown): SavedWeaponRoll[] {
    if (!value || typeof value !== 'object') return [];
    const candidate = value as Partial<SavedWeaponRoll>;
    const selection = sanitizeSelection(candidate.selection);
    const stats = sanitizeNumberRecord(candidate.stats);
    if (
        typeof candidate.id !== 'string' ||
        !candidate.id ||
        typeof candidate.weaponName !== 'string' ||
        typeof candidate.icon !== 'string' ||
        !Number.isFinite(candidate.savedAt) ||
        !selection ||
        !stats ||
        !Array.isArray(candidate.perkNames) ||
        !candidate.perkNames.every((name) => typeof name === 'string')
    ) {
        return [];
    }
    return [
        {
            id: candidate.id,
            selection,
            weaponName: candidate.weaponName,
            icon: candidate.icon,
            subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : '',
            perkNames: candidate.perkNames,
            stats,
            optimalTtk: sanitizeNullableNumber(candidate.optimalTtk),
            range: sanitizeNullableNumber(candidate.range),
            scenario: sanitizeScenario(candidate.scenario),
            engineVersion: typeof candidate.engineVersion === 'string' ? candidate.engineVersion : 'unknown',
            savedAt: candidate.savedAt as number
        }
    ];
}

function sanitizeSelection(value: unknown): WeaponSelection | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<WeaponSelection>;
    const plugs = sanitizeNumberRecord(candidate.plugs, true, true);
    const effects = sanitizeNumberRecord(candidate.effects, true, true);
    if (!isUnsignedInteger(candidate.weaponHash) || !plugs || !effects) return null;
    return { weaponHash: candidate.weaponHash, plugs, effects };
}

function sanitizeNumberRecord(value: unknown, integersOnly = false, numericKeys = false): Record<string, number> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value);
    if (
        entries.some(
            ([key, item]) =>
                !key ||
                (numericKeys && !isUnsignedInteger(Number(key))) ||
                typeof item !== 'number' ||
                !Number.isFinite(item) ||
                (integersOnly && (!Number.isInteger(item) || item < 0 || item > 0xffff_ffff))
        )
    ) {
        return null;
    }
    return Object.fromEntries(entries);
}

function sanitizeScenario(value: unknown): WeaponScenario {
    if (!value || typeof value !== 'object') return { ...DEFAULT_WEAPON_SCENARIO };
    const candidate = value as Partial<WeaponScenario>;
    return {
        mode: candidate.mode === 'pve' ? 'pve' : 'pvp',
        targetHealth: boundedInteger(candidate.targetHealth, 1, 500, DEFAULT_WEAPON_SCENARIO.targetHealth),
        overshield: boundedInteger(candidate.overshield, 0, 100, DEFAULT_WEAPON_SCENARIO.overshield),
        weaponsStat: boundedInteger(candidate.weaponsStat, 100, 200, DEFAULT_WEAPON_SCENARIO.weaponsStat)
    };
}

function sanitizeNullableNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
    return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function isUnsignedInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function getStorage(): StorageLike | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
}
