import type { ArmorStat } from '@rose/armor-domain';

import { STAT_LABELS } from '@/features/armor/display-metadata';

export interface ArmorStatEffect {
    label: string;
    value: string;
}

export interface ArmorStatEffectSummary {
    heading: string;
    effects: ArmorStatEffect[];
    note?: string | undefined;
}

export const armorStatEffectsAt = (stat: ArmorStat, rawValue: number): ArmorStatEffectSummary => {
    const value = Math.max(0, Math.min(200, Math.trunc(rawValue)));
    const baseProgress = Math.min(value, 100) / 100;
    const enhancedProgress = Math.max(0, value - 100) / 100;
    const heading = `${STAT_LABELS[stat]} at ${value}`;

    if (stat === 'health') {
        return {
            heading,
            effects: [
                effect('Orb pickup healing', `${format(70 * baseProgress)} HP`),
                effect('Flinch resistance', `${format(10 * baseProgress)}%`),
                ...(value > 100
                    ? [
                          effect('Shield recharge starts', `${format(25 * enhancedProgress)}% sooner`),
                          effect('Shield recharge duration', `${format(50 * enhancedProgress)}% shorter`),
                          effect('PvE shield capacity', `+${format(20 * enhancedProgress)} HP`)
                      ]
                    : [])
            ],
            note: value <= 100 ? 'Enhanced shield benefits begin above 100.' : undefined
        };
    }

    if (stat === 'weapons') {
        return {
            heading,
            effects: [
                effect('Minor/major damage', `+${format(15 * baseProgress)}% Primary/Special, +${format(10 * baseProgress)}% Heavy`),
                effect('Reload and handling', value > 0 ? `Improved at ${Math.min(value, 100)} stat` : 'No stat bonus'),
                ...(value > 100
                    ? [
                          effect(
                              'Boss damage',
                              `+${format(15 * enhancedProgress)}% Primary/Special, +${format(10 * enhancedProgress)}% Heavy`
                          ),
                          effect('Guardian damage', `+${format(6 * enhancedProgress)}%`),
                          effect('Ammo bricks', 'Improved chance to contain extra ammo')
                      ]
                    : [])
            ],
            note: value <= 100 ? 'Boss, Guardian, and ammo-brick benefits begin above 100.' : undefined
        };
    }

    const enhancedMaximums: Partial<Record<ArmorStat, number>> = {
        melee: 30,
        grenade: 65,
        super: 45
    };
    const effects: ArmorStatEffect[] = [baseAbilityEffect(stat, value)];

    if (stat === 'class' && value > 100) {
        effects.push(
            effect('Class ability overshield', `${format(40 * enhancedProgress)} HP PvE / ${format(10 * enhancedProgress)} HP PvP`)
        );
    }

    const enhancedMaximum = enhancedMaximums[stat];
    if (enhancedMaximum !== undefined && value > 100) {
        effects.push(effect(`${STAT_LABELS[stat]} ability damage`, `+${format(enhancedMaximum * enhancedProgress)}%`));
    }

    return {
        heading,
        effects,
        note: value <= 100 ? enhancedEffectNote(stat) : cooldownNote(stat)
    };
};

const baseAbilityEffect = (stat: ArmorStat, value: number): ArmorStatEffect => {
    if (stat === 'super') {
        return effect('Super energy gains', value > 0 ? `Improved at ${Math.min(value, 100)} stat` : 'No stat bonus');
    }

    return effect(
        `${STAT_LABELS[stat]} cooldown and energy gains`,
        value > 0 ? `Improved at ${Math.min(value, 100)} stat` : 'No stat bonus'
    );
};

const enhancedEffectNote = (stat: ArmorStat): string => {
    if (stat === 'class') {
        return 'Class ability overshields begin above 100.';
    }

    return `${STAT_LABELS[stat]} ability damage begins increasing above 100.`;
};

const cooldownNote = (stat: ArmorStat): string | undefined => {
    if (stat === 'super') {
        return 'Super affects energy gains, not the base Super cooldown.';
    }

    if (stat === 'class' || stat === 'melee' || stat === 'grenade') {
        return 'Exact cooldown depends on the equipped ability.';
    }

    return undefined;
};

const effect = (label: string, value: string): ArmorStatEffect => ({ label, value });

const format = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};
