import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';

export const SUBCLASS_TYPES = ['Prismatic', 'Arc', 'Solar', 'Void', 'Stasis', 'Strand'] as const;

export type SubclassType = (typeof SUBCLASS_TYPES)[number];

export type SubclassFragment = {
    id: string;
    name: string;
    subclass: SubclassType;
    hash: number;
    bonuses: Partial<StatVector>;
};

export const SUBCLASS_FRAGMENTS: SubclassFragment[] = [
    fragment('stasis:whisper-of-durance', 'Whisper of Durance', 'Stasis', 3469412969, { melee: 10 }),
    fragment('stasis:whisper-of-chains', 'Whisper of Chains', 'Stasis', 537774540, { class: 10 }),
    fragment('stasis:whisper-of-conduction', 'Whisper of Conduction', 'Stasis', 2483898429, { super: 10, health: 10 }),
    fragment('stasis:whisper-of-bonds', 'Whisper of Bonds', 'Stasis', 3469412974, { super: -10 }),
    fragment('stasis:whisper-of-hunger', 'Whisper of Hunger', 'Stasis', 2483898431, { melee: -20 }),
    fragment('stasis:whisper-of-fractures', 'Whisper of Fractures', 'Stasis', 537774542, { grenade: -10 }),
    fragment('stasis:whisper-of-impetus', 'Whisper of Impetus', 'Stasis', 537774543, { health: 10 }),
    fragment('stasis:whisper-of-torment', 'Whisper of Torment', 'Stasis', 537774541, { grenade: -10 }),

    fragment('void:echo-of-expulsion', 'Echo of Expulsion', 'Void', 2272984665, { super: 10 }),
    fragment('void:echo-of-provision', 'Echo of Provision', 'Void', 2272984664, { grenade: 10 }),
    fragment('void:echo-of-persistence', 'Echo of Persistence', 'Void', 2272984671, { class: -10 }),
    fragment('void:echo-of-leeching', 'Echo of Leeching', 'Void', 2272984670, { health: 10 }),
    fragment('void:echo-of-domineering', 'Echo of Domineering', 'Void', 2272984657, { grenade: 10 }),
    fragment('void:echo-of-dilation', 'Echo of Dilation', 'Void', 2272984656, { weapons: 10, super: 10 }),
    fragment('void:echo-of-undermining', 'Echo of Undermining', 'Void', 2272984668, { grenade: -10 }),
    fragment('void:echo-of-exchange', 'Echo of Exchange', 'Void', 2272984668, { melee: 10 }),
    fragment('void:echo-of-instability', 'Echo of Instability', 'Void', 2661180600, { melee: 10 }),
    fragment('void:echo-of-obscurity', 'Echo of Obscurity', 'Void', 2661180602, { class: 10 }),
    fragment('void:echo-of-starvation', 'Echo of Starvation', 'Void', 2661180603, { class: -10 }),

    fragment('solar:ember-of-benevolence', 'Ember of Benevolence', 'Solar', 362132292, { grenade: -10 }),
    fragment('solar:ember-of-beams', 'Ember of Beams', 'Solar', 362132295, { super: 10 }),
    fragment('solar:ember-of-empyrean', 'Ember of Empyrean', 'Solar', 362132294, { health: -10 }),
    fragment('solar:ember-of-combustion', 'Ember of Combustion', 'Solar', 362132289, { melee: 10 }),
    fragment('solar:ember-of-char', 'Ember of Char', 'Solar', 362132291, { grenade: 10 }),
    fragment('solar:ember-of-tempering', 'Ember of Tempering', 'Solar', 362132290, { class: -10 }),
    fragment('solar:ember-of-eruption', 'Ember of Eruption', 'Solar', 1051276348, { melee: 10 }),
    fragment('solar:ember-of-wonder', 'Ember of Wonder', 'Solar', 1051276350, { health: 10 }),
    fragment('solar:ember-of-searing', 'Ember of Searing', 'Solar', 1051276351, { class: 10 }),
    fragment('solar:ember-of-torches', 'Ember of Torches', 'Solar', 362132288, { grenade: -10 }),
    fragment('solar:ember-of-mercy', 'Ember of Mercy', 'Solar', 4180586737, { health: 10 }),

    fragment('arc:spark-of-brilliance', 'Spark of Brilliance', 'Arc', 3277705905, { super: 10 }),
    fragment('arc:spark-of-feedback', 'Spark of Feedback', 'Arc', 3277705907, { health: 10 }),
    fragment('arc:spark-of-discharge', 'Spark of Discharge', 'Arc', 1727069362, { melee: -10 }),
    fragment('arc:spark-of-focus', 'Spark of Focus', 'Arc', 1727069360, { class: -10 }),
    fragment('arc:spark-of-volts', 'Spark of Volts', 'Arc', 3277705904, { class: 10 }),
    fragment('arc:spark-of-resistance', 'Spark of Resistance', 'Arc', 1727069366, { melee: 10 }),
    fragment('arc:spark-of-shock', 'Spark of Shock', 'Arc', 1727069364, { grenade: -10 }),

    fragment('strand:thread-of-fury', 'Thread of Fury', 'Strand', 4208512219, { melee: -10 }),
    fragment('strand:thread-of-ascent', 'Thread of Ascent', 'Strand', 4208512216, { weapons: 10 }),
    fragment('strand:thread-of-finality', 'Thread of Finality', 'Strand', 4208512217, { class: 10 }),
    fragment('strand:thread-of-warding', 'Thread of Warding', 'Strand', 4208512222, { health: -10 }),
    fragment('strand:thread-of-transmutation', 'Thread of Transmutation', 'Strand', 4208512221, { melee: 10 }),
    fragment('strand:thread-of-evolution', 'Thread of Evolution', 'Strand', 4208512211, { super: 10 }),
    fragment('strand:thread-of-binding', 'Thread of Binding', 'Strand', 3192552688, { health: 10 }),
    fragment('strand:thread-of-generation', 'Thread of Generation', 'Strand', 3192552691, { grenade: -10 }),
    fragment('strand:thread-of-propagation', 'Thread of Propagation', 'Strand', 4208512210, { melee: 10 }),

    fragment('prismatic:facet-of-awakening', 'Facet of Awakening', 'Prismatic', 124726505, { health: 10 }),
    fragment('prismatic:facet-of-courage', 'Facet of Courage', 'Prismatic', 2626922124, { grenade: 10 }),
    fragment('prismatic:facet-of-dawn', 'Facet of Dawn', 'Prismatic', 2626922126, { melee: -10 }),
    fragment('prismatic:facet-of-defiance', 'Facet of Defiance', 'Prismatic', 74393640, { class: 10 }),
    fragment('prismatic:facet-of-devotion', 'Facet of Devotion', 'Prismatic', 2626922125, { melee: 10 }),
    fragment('prismatic:facet-of-dominance', 'Facet of Dominance', 'Prismatic', 124726504, { grenade: -10 }),
    fragment('prismatic:facet-of-grace', 'Facet of Grace', 'Prismatic', 2626922121, { health: -10 }),
    fragment('prismatic:facet-of-honor', 'Facet of Honor', 'Prismatic', 124726501, { melee: 10 }),
    fragment('prismatic:facet-of-justice', 'Facet of Justice', 'Prismatic', 2626922115, { super: 10 }),
    fragment('prismatic:facet-of-protection', 'Facet of Protection', 'Prismatic', 2626922120, { melee: 10 }),
    fragment('prismatic:facet-of-purpose', 'Facet of Purpose', 'Prismatic', 124726498, { class: -10 }),
    fragment('prismatic:facet-of-ruin', 'Facet of Ruin', 'Prismatic', 124726499, { weapons: 10 }),
    fragment('prismatic:facet-of-sacrifice', 'Facet of Sacrifice', 'Prismatic', 124726502, { grenade: 10 })
];

const FRAGMENTS_BY_ID = new Map(SUBCLASS_FRAGMENTS.map((fragment) => [fragment.id, fragment]));

export function isSubclassType(value: string): value is SubclassType {
    return (SUBCLASS_TYPES as readonly string[]).includes(value);
}

export function sanitizeFragmentIds(ids: unknown, subclass: SubclassType) {
    if (!Array.isArray(ids)) {
        return [];
    }

    const seen = new Set<string>();
    const sanitized: string[] = [];
    for (const id of ids) {
        const fragment = FRAGMENTS_BY_ID.get(id);
        if (!fragment || fragment.subclass !== subclass || seen.has(id)) {
            continue;
        }

        seen.add(id);
        sanitized.push(id);
    }

    return sanitized;
}

export function fragmentsForSubclass(subclass: SubclassType) {
    return SUBCLASS_FRAGMENTS.filter((fragment) => fragment.subclass === subclass);
}

export function sumFragmentBonuses(fragmentIds: readonly string[]): StatVector {
    const total = emptyStats();

    for (const id of fragmentIds) {
        const fragment = FRAGMENTS_BY_ID.get(id);
        if (!fragment) {
            continue;
        }

        for (const stat of ARMOR_STATS) {
            total[stat] += fragment.bonuses[stat] ?? 0;
        }
    }

    return total;
}

function emptyStats(): StatVector {
    return {
        health: 0,
        melee: 0,
        grenade: 0,
        super: 0,
        class: 0,
        weapons: 0
    };
}

export function formatFragmentBonus(fragment: SubclassFragment) {
    return ARMOR_STATS.filter((stat) => fragment.bonuses[stat])
        .map((stat) => `${formatSigned(fragment.bonuses[stat] ?? 0)} ${statLabel(stat)}`)
        .join(', ');
}

function fragment(id: string, name: string, subclass: SubclassType, hash: number, bonuses: Partial<StatVector>): SubclassFragment {
    return { id, name, subclass, hash, bonuses };
}

function formatSigned(value: number) {
    return value > 0 ? `+${value}` : String(value);
}

function statLabel(stat: ArmorStat) {
    return stat === 'class' ? 'Class' : stat.charAt(0).toUpperCase() + stat.slice(1);
}
