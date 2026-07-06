import type { ArmorSetBonusInfo } from '@/features/armor/types';

export type OpArmorSetBonus = {
    id: string;
    source: string;
    requiredPieces: 2 | 4;
    category: string;
    trigger: string;
    effect: string;
    bugged?: boolean;
    aliases: string[];
};

type MatchableArmorSet = {
    name: string;
    bonuses: ArmorSetBonusInfo[];
};

export const OP_ARMOR_SET_BONUSES: OpArmorSetBonus[] = [
    {
        id: 'spire-4',
        source: 'Spire',
        requiredPieces: 4,
        category: 'DPS',
        trigger: 'Precision damage within a short window of weapon ready.',
        effect: '7% weapon damage for 3s, doubled for Tex Mechanica weapons.',
        aliases: ['tm custom', 'high noon', 'old martian diplomacy', 'tm-earp', 'tex mechanica custom']
    },
    {
        id: 'nessus-4',
        source: 'Nessus',
        requiredPieces: 4,
        category: 'Survivability',
        trigger: 'Gaining, losing, or spending Armor Charge.',
        effect: '13% / 21% / 30% DR, up to 35%; extends 3s per stack, heals and starts critical health regeneration.',
        aliases: ['exodus down', 'repurposed charge', 'emergency electromagnet']
    },
    {
        id: 'salvations-edge-2',
        source: "Salvation's Edge",
        requiredPieces: 2,
        category: 'Survivability / DPS',
        trigger: 'Elite+ kill.',
        effect: '25% DR and 7% damage for 12s, refreshable.',
        aliases: ['promised', 'stable resonance', 'resonance redirection']
    },
    {
        id: 'vog-4',
        source: 'VoG',
        requiredPieces: 4,
        category: 'Damage',
        trigger: 'Five damage instances while a subclass buff is active, such as Radiant or Devour.',
        effect: 'Spawns an Orb of Power at your feet with a 5s internal cooldown.',
        aliases: ["atheon's memory", 'atheons memory', 'collective power', 'radiolaria breach']
    },
    {
        id: 'prophecy-4',
        source: 'Prophecy',
        requiredPieces: 4,
        category: 'Ability regen / Survivability',
        trigger: 'Light weapon kills, Dark or Kinetic weapon kills, and alternating weapon kills within a short window.',
        effect: '+22% grenade energy, +22% melee energy, and 40% DR for 5s on alternating weapon kills.',
        aliases: ['coda', 'so very thin', 'between poles']
    },
    {
        id: 'smoke-jumper-2',
        source: 'Smoke Jumper',
        requiredPieces: 2,
        category: 'Survivability',
        trigger: 'Orb pickup.',
        effect: '40% DR decaying over 3s.',
        aliases: ['smoke jumper', 'ride together die together', 'too old for this']
    },
    {
        id: 'dsc-2',
        source: 'DSC',
        requiredPieces: 2,
        category: 'Splash debuff',
        trigger: 'Powered melee kill.',
        effect: '9m disorienting pulse, constantly re-proccable.',
        aliases: ["legacy's oath", 'legacys oath', 'augmented servos', 'god like judgment']
    },
    {
        id: 'europa-2',
        source: 'Europa',
        requiredPieces: 2,
        category: 'Ammo gen',
        trigger: 'Kill, with a 12s internal cooldown; currently working in combat.',
        effect: 'Additive 20% ammo progress for both ammo types and an Orb of Power spawn.',
        bugged: true,
        aliases: ['crystocrene', 'resupply', 'from the storm']
    },
    {
        id: 'ron-4',
        source: 'RoN',
        requiredPieces: 4,
        category: 'Survivability',
        trigger: 'Elite+ finisher or Devour proc.',
        effect: 'Devour and 20% DR.',
        aliases: ["nezarec's nightmare", 'nezarecs nightmare', 'dream devourer', 'bad dreams']
    },
    {
        id: 'pantheon-2',
        source: 'Pantheon',
        requiredPieces: 2,
        category: 'Ammo gen',
        trigger: 'Ammo pickup and Armor Charge.',
        effect: '+Armor Charge on ammo pickup and 10 health per Armor Charge stack.',
        aliases: ['pantheon', 'pantheos resplendent']
    },
    {
        id: 'kf-4',
        source: 'KF',
        requiredPieces: 4,
        category: 'Survivability',
        trigger: 'Critical health after Elite+ kill.',
        effect: 'Invisibility for 6-8s with no internal cooldown.',
        aliases: ["oryx's memory", 'oryxs memory', 'ascendant escape', 'iron sharpens iron']
    },
    {
        id: 'duality-4',
        source: 'Duality',
        requiredPieces: 4,
        category: 'Survivability',
        trigger: 'Weapon stow.',
        effect: '35 / 65 / 87.5 / 105 / 130 / 170 / 195 HP per stack.',
        aliases: ['duality', 'deep explorer']
    },
    {
        id: 'kepler-2',
        source: 'Kepler',
        requiredPieces: 2,
        category: 'Survivability',
        trigger: 'Micro-missile, rocket, or grenade launcher kill.',
        effect: '20% splash DR and 60% self-explosive DR for 15s.',
        aliases: ['aion adapter', 'force absorption', 'reactive shock']
    },
    {
        id: 'kf-2',
        source: 'KF',
        requiredPieces: 2,
        category: 'Ammo gen',
        trigger: 'Elite+ kill.',
        effect: 'Additive 12% special ammo progress and 7.5% heavy ammo progress.',
        aliases: ["oryx's memory", 'oryxs memory', 'iron sharpens iron', 'ascendant escape']
    },
    {
        id: 'last-wish-4',
        source: 'Last Wish',
        requiredPieces: 4,
        category: 'Ammo gen',
        trigger: 'Grenade kills.',
        effect: 'Additive 10% heavy ammo progress.',
        aliases: ['great hunt', 'taken armaments', 'taken barrier']
    },
    {
        id: 'shattered-throne-4',
        source: 'Shattered Throne',
        requiredPieces: 4,
        category: 'Survivability / Ability regen',
        trigger: 'Build stacks from damage, kills, and finishers; max 999 stacks.',
        effect: 'Up to 15% DR, +50% grenade/melee regen, and +35% class regen.',
        aliases: ["techeun's regalia", 'techeuns regalia', 'truth to power', 'queensfoil rush']
    },
    {
        id: 'equilibrium-2',
        source: 'Equilibrium',
        requiredPieces: 2,
        category: 'Ability regen',
        trigger: 'Sword damage.',
        effect: '+5% grenade and class energy, or 10% if Blade Focus is active.',
        aliases: ['sage protector', 'combat meditation', 'blade focus']
    },
    {
        id: 'crota-4',
        source: 'Crota',
        requiredPieces: 4,
        category: 'Survivability',
        trigger: 'Being in combat for 12s; ends after being out of combat for 7s.',
        effect: 'Flinch resistance and 15% DR, increasing to 25% after 24s in combat.',
        aliases: ["crota's memory", 'crotas memory', 'power of the son', 'cursed fist']
    }
];

export function getOpArmorSetBonuses(set: MatchableArmorSet) {
    const haystack = normalizeSearchText([set.name, ...set.bonuses.flatMap((bonus) => [bonus.name, bonus.description ?? ''])]);

    return OP_ARMOR_SET_BONUSES.filter((bonus) => bonus.aliases.some((alias) => haystack.includes(normalizeSearchText([alias]))));
}

export function opArmorSetSortRank(set: MatchableArmorSet) {
    const matches = getOpArmorSetBonuses(set);
    if (matches.length === 0) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.min(...matches.map((match) => OP_ARMOR_SET_BONUSES.findIndex((bonus) => bonus.id === match.id)));
}

function normalizeSearchText(parts: string[]) {
    return parts
        .join(' ')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
