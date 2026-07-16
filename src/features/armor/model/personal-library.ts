import { ARMOR_SLOTS, ARMOR_STATS, type ArmorBuild, type ArmorItem, type ArmorSlot, type DestinyClass } from '@rose/armor-domain';

import { buildExpansionKey } from '@/features/armor/result-display';

const PERSONAL_LIBRARY_KEY_PREFIX = 'rose.armor-library.v1';
const MAX_SAVED_BUILDS = 50;

export interface SavedArmorBuild {
    id: string;
    savedAt: string;
    characterId: string;
    characterClass: DestinyClass;
    build: ArmorBuild;
}

export interface PersonalArmorLibrary {
    favoriteExoticItemHashes: number[];
    savedBuilds: SavedArmorBuild[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type PersonalArmorLibraryWriteResult =
    | { ok: true }
    | { ok: false; reason: 'storage-unavailable' | 'quota-exceeded' | 'write-failed' };

type CompactArmorItem = Omit<ArmorItem, 'baseStats' | 'statModOptions' | 'tuningOptions' | 'debugWarnings'>;

type CompactArmorBuild = Omit<ArmorBuild, 'pieces'> & {
    pieces: Record<ArmorSlot, Omit<ArmorBuild['pieces'][ArmorSlot], 'item'> & { item: CompactArmorItem }>;
};

type StoredPersonalArmorLibrary = {
    schemaVersion: 2;
    favoriteExoticItemHashes: number[];
    savedBuilds: Array<Omit<SavedArmorBuild, 'build'> & { build: CompactArmorBuild }>;
};

export const EMPTY_PERSONAL_ARMOR_LIBRARY: PersonalArmorLibrary = {
    favoriteExoticItemHashes: [],
    savedBuilds: []
};

export const readPersonalArmorLibrary = (ownerId: string, storage = getLocalStorage()): PersonalArmorLibrary => {
    if (!storage || !ownerId) {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }

    try {
        const raw = storage.getItem(storageKey(ownerId));
        if (!raw) {
            return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
        }

        return sanitizePersonalArmorLibrary(JSON.parse(raw));
    } catch {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }
};

export const writePersonalArmorLibrary = (
    ownerId: string,
    library: PersonalArmorLibrary,
    storage = getLocalStorage()
): PersonalArmorLibraryWriteResult => {
    if (!storage || !ownerId) {
        return { ok: false, reason: 'storage-unavailable' };
    }

    try {
        storage.setItem(storageKey(ownerId), JSON.stringify(compactPersonalArmorLibrary(library)));
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            reason: isQuotaExceededError(error) ? 'quota-exceeded' : 'write-failed'
        };
    }
};

export const toggleFavoriteExotic = (favorites: readonly number[], itemHash: number): number[] => {
    const next = new Set(favorites.filter(isItemHash));
    if (next.has(itemHash)) {
        next.delete(itemHash);
    } else if (isItemHash(itemHash)) {
        next.add(itemHash);
    }

    return [...next];
};

export const saveArmorBuild = (
    savedBuilds: readonly SavedArmorBuild[],
    build: ArmorBuild,
    metadata: { characterId: string; characterClass: DestinyClass; savedAt?: string }
): SavedArmorBuild[] => {
    const id = buildExpansionKey(build);
    const savedBuild: SavedArmorBuild = {
        id,
        savedAt: metadata.savedAt ?? new Date().toISOString(),
        characterId: metadata.characterId,
        characterClass: metadata.characterClass,
        build
    };

    return [savedBuild, ...savedBuilds.filter((candidate) => candidate.id !== id)].slice(0, MAX_SAVED_BUILDS);
};

export const removeSavedArmorBuild = (savedBuilds: readonly SavedArmorBuild[], build: ArmorBuild): SavedArmorBuild[] => {
    const id = buildExpansionKey(build);
    return savedBuilds.filter((candidate) => candidate.id !== id);
};

export const isArmorBuildSaved = (savedBuilds: readonly SavedArmorBuild[], build: ArmorBuild): boolean => {
    const id = buildExpansionKey(build);
    return savedBuilds.some((candidate) => candidate.id === id);
};

export const sanitizePersonalArmorLibrary = (value: unknown): PersonalArmorLibrary => {
    if (!isRecord(value)) {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }

    const favoriteExoticItemHashes = Array.isArray(value['favoriteExoticItemHashes'])
        ? [...new Set(value['favoriteExoticItemHashes'].filter(isItemHash))]
        : [];
    const savedBuilds = Array.isArray(value['savedBuilds'])
        ? value['savedBuilds'].filter(isSavedArmorBuild).slice(0, MAX_SAVED_BUILDS).map(hydrateSavedArmorBuild)
        : [];

    return {
        favoriteExoticItemHashes,
        savedBuilds
    };
};

const compactPersonalArmorLibrary = (library: PersonalArmorLibrary): StoredPersonalArmorLibrary => {
    const sanitized = sanitizePersonalArmorLibrary(library);

    return {
        schemaVersion: 2,
        favoriteExoticItemHashes: sanitized.favoriteExoticItemHashes,
        savedBuilds: sanitized.savedBuilds.map((entry) => ({
            ...entry,
            build: {
                ...entry.build,
                pieces: Object.fromEntries(
                    ARMOR_SLOTS.map((slot) => {
                        const piece = entry.build.pieces[slot];
                        const {
                            baseStats: _baseStats,
                            statModOptions: _statModOptions,
                            tuningOptions: _tuningOptions,
                            debugWarnings: _debugWarnings,
                            ...item
                        } = piece.item;

                        return [slot, { ...piece, item }];
                    })
                ) as CompactArmorBuild['pieces']
            }
        }))
    };
};

const hydrateSavedArmorBuild = (entry: SavedArmorBuild): SavedArmorBuild => ({
    ...entry,
    build: {
        ...entry.build,
        pieces: Object.fromEntries(
            ARMOR_SLOTS.map((slot) => {
                const piece = entry.build.pieces[slot];

                return [
                    slot,
                    {
                        ...piece,
                        item: {
                            ...piece.item,
                            baseStats: isStatVector(piece.item.baseStats) ? piece.item.baseStats : emptyStats(),
                            statModOptions: Array.isArray(piece.item.statModOptions) ? piece.item.statModOptions : [],
                            tuningOptions: Array.isArray(piece.item.tuningOptions) ? piece.item.tuningOptions : []
                        }
                    }
                ];
            })
        ) as ArmorBuild['pieces']
    }
});

const isSavedArmorBuild = (value: unknown): value is SavedArmorBuild => {
    if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['savedAt'] !== 'string') {
        return false;
    }

    if (typeof value['characterId'] !== 'string' || typeof value['characterClass'] !== 'string') {
        return false;
    }

    return isArmorBuild(value['build']);
};

const isArmorBuild = (value: unknown): value is ArmorBuild => {
    if (!isRecord(value) || !isRecord(value['pieces']) || !isRecord(value['stats']) || !isRecord(value['score'])) {
        return false;
    }

    const pieces = value['pieces'];
    const stats = value['stats'];
    const score = value['score'];
    const piecesValid = ARMOR_SLOTS.every((slot) => {
        const piece = pieces[slot];
        return (
            isRecord(piece) &&
            isRecord(piece['item']) &&
            typeof piece['item']['itemInstanceId'] === 'string' &&
            typeof piece['item']['itemHash'] === 'number' &&
            typeof piece['item']['name'] === 'string' &&
            piece['item']['slot'] === slot
        );
    });
    const statsValid = ARMOR_STATS.every((stat) => Number.isFinite(stats[stat]));

    return (
        piecesValid &&
        statsValid &&
        Array.isArray(value['activeSetBonuses']) &&
        Number.isFinite(score['wastedStats']) &&
        Number.isFinite(score['totalStats'])
    );
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isStatVector = (value: unknown): value is ArmorItem['baseStats'] =>
    isRecord(value) && ARMOR_STATS.every((stat) => Number.isFinite(value[stat]));

const emptyStats = (): ArmorItem['baseStats'] => ({
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapons: 0
});

const isQuotaExceededError = (error: unknown): boolean =>
    isRecord(error) && (error['name'] === 'QuotaExceededError' || error['code'] === 22 || error['code'] === 1014);

const isItemHash = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

const storageKey = (ownerId: string): string => `${PERSONAL_LIBRARY_KEY_PREFIX}.${ownerId}`;

const getLocalStorage = (): StorageLike | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);
