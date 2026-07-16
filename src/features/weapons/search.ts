import type { WeaponCatalog, WeaponDefinition, WeaponFilterState } from '@rose/weapon-model';

export const EMPTY_WEAPON_FILTERS: WeaponFilterState = {
    query: ''
};

type WeaponSearchField =
    | 'adept'
    | 'ammo'
    | 'craftable'
    | 'element'
    | 'frame'
    | 'hash'
    | 'is'
    | 'name'
    | 'perk'
    | 'rarity'
    | 'rpm'
    | 'slot'
    | 'source'
    | 'trait_1'
    | 'trait_2'
    | 'weapon';

type WeaponSearchClause = {
    field: WeaponSearchField | 'unknown';
    negated: boolean;
    values: string[][];
};

type NormalizedSearchText = {
    compact: string;
    spaced: string;
};

type WeaponSearchCache = {
    fields: Map<string, NormalizedSearchText>;
    perks: Map<number, NormalizedSearchText>;
    plugSets: Map<number, NormalizedSearchText>;
    traits: Map<string, NormalizedSearchText>;
};

const FIELD_ALIASES: Record<string, WeaponSearchField> = {
    adept: 'adept',
    ammo: 'ammo',
    craftable: 'craftable',
    element: 'element',
    energy: 'element',
    frame: 'frame',
    hash: 'hash',
    intrinsic: 'frame',
    is: 'is',
    name: 'name',
    perk: 'perk',
    rarity: 'rarity',
    rpm: 'rpm',
    slot: 'slot',
    source: 'source',
    trait: 'perk',
    trait_1: 'trait_1',
    trait_2: 'trait_2',
    type: 'weapon',
    weapon: 'weapon'
};

const searchCaches = new WeakMap<WeaponCatalog, WeaponSearchCache>();
const primedCatalogs = new WeakSet<WeaponCatalog>();

export function filterWeapons(catalog: WeaponCatalog, filters: WeaponFilterState) {
    const clauses = parseWeaponQuery(filters.query);
    if (clauses.length === 0) return catalog.weapons;
    return catalog.weapons.filter((weapon) => clauses.every((clause) => matchesClause(catalog, weapon, clause)));
}

export const rankWeaponResults = (weapons: WeaponDefinition[], query: string): WeaponDefinition[] => {
    const terms = tokenizeQuery(query).flatMap((token) => {
        if (token.startsWith('-') || token.includes(':')) return [];
        const normalized = normalizeSearch(token);
        return normalized ? [normalized] : [];
    });
    if (terms.length === 0) return weapons;

    const originalOrder = new Map(weapons.map((weapon, index) => [weapon.hash, index]));
    return [...weapons].sort((left, right) => {
        const scoreDifference = resultNameScore(left.name, terms) - resultNameScore(right.name, terms);
        return scoreDifference || (originalOrder.get(left.hash) ?? 0) - (originalOrder.get(right.hash) ?? 0);
    });
};

export function primeWeaponSearch(catalog: WeaponCatalog) {
    if (typeof window === 'undefined' || primedCatalogs.has(catalog)) return;
    primedCatalogs.add(catalog);
    let index = 0;

    const primeChunk = () => {
        const end = Math.min(index + 40, catalog.weapons.length);
        for (; index < end; index += 1) {
            const weapon = catalog.weapons[index];
            if (!weapon) continue;
            perkSearchText(catalog, weapon);
            traitSearchText(catalog, weapon, 0);
            traitSearchText(catalog, weapon, 1);
        }
        if (index < catalog.weapons.length) scheduleIdle(primeChunk);
    };

    scheduleIdle(primeChunk);
}

function parseWeaponQuery(query: string) {
    return tokenizeQuery(query).flatMap<WeaponSearchClause>((rawToken) => {
        let token = rawToken;
        let negated = false;
        if (token.startsWith('-')) {
            token = token.slice(1);
            negated = true;
        }

        const separator = token.indexOf(':');
        if (separator < 1) {
            return createClause('name', token, negated);
        }

        const field = FIELD_ALIASES[normalizeField(token.slice(0, separator))] ?? 'unknown';
        let value = token.slice(separator + 1);
        if (value.startsWith('!')) {
            value = value.slice(1);
            negated = !negated;
        }
        return createClause(field, value, negated);
    });
}

function createClause(field: WeaponSearchClause['field'], value: string, negated: boolean): WeaponSearchClause[] {
    const values = value
        .split(',')
        .map((group) => group.split('|').map(normalizeSearch).filter(Boolean))
        .filter((group) => group.length > 0);
    return values.length > 0 ? [{ field, negated, values }] : [];
}

function matchesClause(catalog: WeaponCatalog, weapon: WeaponDefinition, clause: WeaponSearchClause) {
    const matched = clause.values.every((alternatives) =>
        alternatives.some((value) => matchesFieldValue(catalog, weapon, clause.field, value))
    );
    return clause.negated ? !matched : matched;
}

function matchesFieldValue(catalog: WeaponCatalog, weapon: WeaponDefinition, field: WeaponSearchClause['field'], value: string) {
    if (field === 'unknown') return false;
    if (field === 'is') return matchesIsFilter(catalog, weapon, value);
    if (field === 'perk') return includesSearchText(perkSearchText(catalog, weapon), value);
    if (field === 'trait_1') return includesSearchText(traitSearchText(catalog, weapon, 0), value);
    if (field === 'trait_2') return includesSearchText(traitSearchText(catalog, weapon, 1), value);

    return includesSearchText(fieldSearchText(catalog, weapon, field), value);
}

function fieldValues(weapon: WeaponDefinition, field: Exclude<WeaponSearchField, 'is' | 'perk' | 'trait_1' | 'trait_2'>) {
    switch (field) {
        case 'name':
            return [weapon.name, String(weapon.hash)];
        case 'weapon':
            return [weapon.type];
        case 'frame':
            return [weapon.intrinsicName];
        case 'source':
            return [weapon.source];
        case 'ammo':
            return [weapon.ammo];
        case 'element':
            return [weapon.element];
        case 'slot':
            return [weapon.slot];
        case 'rarity':
            return [weapon.rarity];
        case 'hash':
            return [String(weapon.hash)];
        case 'rpm':
            return weapon.stats
                .filter((stat) => stat.name === 'Rounds Per Minute' || stat.name === 'RPM')
                .map((stat) => String(Math.round(stat.value)));
        case 'craftable':
            return [String(weapon.craftable)];
        case 'adept':
            return [String(weapon.adept)];
    }
}

function fieldSearchText(
    catalog: WeaponCatalog,
    weapon: WeaponDefinition,
    field: Exclude<WeaponSearchField, 'is' | 'perk' | 'trait_1' | 'trait_2'>
) {
    const cache = searchCache(catalog);
    const key = `${weapon.hash}:${field}`;
    const cached = cache.fields.get(key);
    if (cached) return cached;
    const texts = fieldValues(weapon, field).map(toSearchText);
    const result = {
        spaced: texts.map((text) => text.spaced).join(' '),
        compact: texts.map((text) => text.compact).join('|')
    };
    cache.fields.set(key, result);
    return result;
}

function matchesIsFilter(catalog: WeaponCatalog, weapon: WeaponDefinition, value: string) {
    if (value === 'craftable') return weapon.craftable;
    if (value === 'adept') return weapon.adept;
    if (value === 'randomroll' || value === 'randomrolls') {
        return weapon.sockets.some((socket) => (catalog.plugSets[socket.plugSet]?.length ?? 0) > 1);
    }
    if (['exotic', 'legendary', 'rare', 'uncommon', 'common'].includes(value)) return weapon.rarity === value;
    if (['primary', 'special', 'heavy'].includes(value)) return weapon.ammo === value;
    if (['arc', 'solar', 'void', 'stasis', 'strand'].includes(value)) return weapon.element === value;
    if (value === 'kinetic') return weapon.element === 'kinetic';
    if (['energy', 'power'].includes(value)) return weapon.slot === value;
    return false;
}

function traitSockets(weapon: WeaponDefinition) {
    return weapon.sockets.filter((socket) => normalizeSearch(socket.label) === 'trait');
}

function perkSearchText(catalog: WeaponCatalog, weapon: WeaponDefinition) {
    const cache = searchCache(catalog);
    const cached = cache.perks.get(weapon.hash);
    if (cached) return cached;
    const socketText = weapon.sockets.map((socket) => plugSetSearchText(catalog, socket.plugSet));
    const spaced = [normalizeSearch(weapon.intrinsicName), ...socketText.map((text) => text.spaced)].filter(Boolean).join(' ');
    const compact = [normalizeSearch(weapon.intrinsicName).replaceAll(' ', ''), ...socketText.map((text) => text.compact)].join('|');
    const result = { spaced, compact };
    cache.perks.set(weapon.hash, result);
    return result;
}

function traitSearchText(catalog: WeaponCatalog, weapon: WeaponDefinition, column: number) {
    const cache = searchCache(catalog);
    const key = `${weapon.hash}:${column}`;
    const cached = cache.traits.get(key);
    if (cached) return cached;
    const socket = traitSockets(weapon)[column];
    const result = socket ? plugSetSearchText(catalog, socket.plugSet) : { spaced: '', compact: '' };
    cache.traits.set(key, result);
    return result;
}

function plugSetSearchText(catalog: WeaponCatalog, plugSet: number) {
    const cache = searchCache(catalog);
    const cached = cache.plugSets.get(plugSet);
    if (cached) return cached;
    const names = (catalog.plugSets[plugSet] ?? []).flatMap((hash) => {
        const name = catalog.plugs[String(hash)]?.name;
        return name ? [normalizeSearch(name)] : [];
    });
    const result = {
        spaced: names.join(' '),
        compact: names.map((name) => name.replaceAll(' ', '')).join('|')
    };
    cache.plugSets.set(plugSet, result);
    return result;
}

function searchCache(catalog: WeaponCatalog) {
    let cache = searchCaches.get(catalog);
    if (!cache) {
        cache = { fields: new Map(), perks: new Map(), plugSets: new Map(), traits: new Map() };
        searchCaches.set(catalog, cache);
    }
    return cache;
}

function includesSearchText(candidate: NormalizedSearchText, normalizedQuery: string) {
    return candidate.spaced.includes(normalizedQuery) || candidate.compact.includes(normalizedQuery.replaceAll(' ', ''));
}

const resultNameScore = (name: string, terms: string[]): number => {
    const normalized = normalizeSearch(name);
    const words = normalized.split(' ');
    const compact = normalized.replaceAll(' ', '');
    return terms.reduce((score, term) => {
        if (normalized === term) return score;
        if (normalized.startsWith(term)) return score + 1;
        if (words.some((word) => word.startsWith(term))) return score + 2;
        if (normalized.includes(term)) return score + 3;
        if (compact.includes(term.replaceAll(' ', ''))) return score + 4;
        return score + 5;
    }, 0);
};

function toSearchText(value: string): NormalizedSearchText {
    const spaced = normalizeSearch(value);
    return { spaced, compact: spaced.replaceAll(' ', '') };
}

function tokenizeQuery(query: string) {
    const tokens: string[] = [];
    let token = '';
    let quoted = false;
    let escaping = false;

    for (const character of query.trim()) {
        if (escaping) {
            token += character;
            escaping = false;
        } else if (character === '\\') {
            escaping = true;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (/\s/.test(character) && !quoted) {
            if (token) tokens.push(token);
            token = '';
        } else {
            token += character;
        }
    }
    if (escaping) token += '\\';
    if (token) tokens.push(token);
    return tokens;
}

function normalizeSearch(value: string) {
    return value
        .toLocaleLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeField(value: string) {
    return value.toLocaleLowerCase().trim().replaceAll('-', '_');
}

function scheduleIdle(callback: () => void) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 500 });
    } else {
        window.setTimeout(callback, 16);
    }
}
