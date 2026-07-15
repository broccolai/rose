import type { WeaponScenario, WeaponSelection } from '@/features/weapons/types';

export const DEFAULT_WEAPON_SCENARIO: WeaponScenario = {
    mode: 'pvp',
    targetHealth: 230,
    overshield: 0,
    weaponsStat: 100
};

export function encodeWeaponSelection(selection: WeaponSelection, scenario?: WeaponScenario) {
    const params = new URLSearchParams();
    params.set('w', String(selection.weaponHash));
    const plugs = encodeRecord(selection.plugs);
    const effects = encodeRecord(selection.effects);
    if (plugs) params.set('p', plugs);
    if (effects) params.set('e', effects);
    if (scenario?.mode === 'pve') params.set('m', 'pve');
    if (scenario && scenario.targetHealth !== DEFAULT_WEAPON_SCENARIO.targetHealth) params.set('hp', String(scenario.targetHealth));
    if (scenario && scenario.overshield !== DEFAULT_WEAPON_SCENARIO.overshield) params.set('os', String(scenario.overshield));
    if (scenario && scenario.weaponsStat !== DEFAULT_WEAPON_SCENARIO.weaponsStat) params.set('ws', String(scenario.weaponsStat));
    return params;
}

export function decodeWeaponSelection(params: URLSearchParams): WeaponSelection | null {
    const weaponHash = parseUnsignedInteger(params.get('w'));
    if (!weaponHash) return null;
    return {
        weaponHash,
        plugs: decodeRecord(params.get('p')),
        effects: decodeRecord(params.get('e'))
    };
}

export function decodeWeaponScenario(params: URLSearchParams): WeaponScenario {
    return {
        mode: params.get('m') === 'pve' ? 'pve' : 'pvp',
        targetHealth: parseBoundedInteger(params.get('hp'), 1, 500, DEFAULT_WEAPON_SCENARIO.targetHealth),
        overshield: parseBoundedInteger(params.get('os'), 0, 100, DEFAULT_WEAPON_SCENARIO.overshield),
        weaponsStat: parseBoundedInteger(params.get('ws'), 100, 200, DEFAULT_WEAPON_SCENARIO.weaponsStat)
    };
}

export function selectionUrl(selection: WeaponSelection, location: Pick<Location, 'origin' | 'pathname'>, scenario?: WeaponScenario) {
    return `${location.origin}${location.pathname}?${encodeWeaponSelection(selection, scenario).toString()}`;
}

function encodeRecord(record: Record<string, number>) {
    return Object.entries(record)
        .filter(([key, value]) => parseUnsignedInteger(key) !== null && Number.isFinite(value))
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([key, value]) => `${key}:${value}`)
        .join(',');
}

function decodeRecord(value: string | null) {
    if (!value) return {};
    const result: Record<string, number> = {};
    for (const entry of value.split(',')) {
        const [rawKey, rawValue, extra] = entry.split(':');
        const key = parseUnsignedInteger(rawKey ?? null);
        const parsedValue = Number(rawValue);
        if (extra === undefined && key !== null && Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 0xffff_ffff) {
            result[String(key)] = parsedValue;
        }
    }
    return result;
}

function parseUnsignedInteger(value: string | null) {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 0xffff_ffff ? parsed : null;
}

function parseBoundedInteger(value: string | null, minimum: number, maximum: number, fallback: number) {
    if (!value || !/^-?\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
