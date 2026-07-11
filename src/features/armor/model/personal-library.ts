import { ARMOR_SLOTS, ARMOR_STATS, type ArmorBuild, type DestinyClass } from '@armor-calc';

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

export const EMPTY_PERSONAL_ARMOR_LIBRARY: PersonalArmorLibrary = {
    favoriteExoticItemHashes: [],
    savedBuilds: []
};

export const readPersonalArmorLibrary = (ownerId: string, storage = getLocalStorage()): PersonalArmorLibrary => {
    if (!storage || !ownerId) {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }

    const raw = storage.getItem(storageKey(ownerId));
    if (!raw) {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }

    try {
        return sanitizePersonalArmorLibrary(JSON.parse(raw));
    } catch {
        return { ...EMPTY_PERSONAL_ARMOR_LIBRARY };
    }
};

export const writePersonalArmorLibrary = (ownerId: string, library: PersonalArmorLibrary, storage = getLocalStorage()): void => {
    if (!storage || !ownerId) {
        return;
    }

    storage.setItem(storageKey(ownerId), JSON.stringify(sanitizePersonalArmorLibrary(library)));
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
        ? value['savedBuilds'].filter(isSavedArmorBuild).slice(0, MAX_SAVED_BUILDS)
        : [];

    return {
        favoriteExoticItemHashes,
        savedBuilds
    };
};

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

const isItemHash = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

const storageKey = (ownerId: string): string => `${PERSONAL_LIBRARY_KEY_PREFIX}.${ownerId}`;

const getLocalStorage = (): StorageLike | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);
