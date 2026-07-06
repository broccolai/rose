import { describe, expect, test } from 'bun:test';

import { getOpArmorSetBonuses } from '@/features/armor/op-set-bonuses';
import type { ArmorSetBonusInfo } from '@/features/armor/types';

describe('op armor set bonus matching', () => {
    test.each([
        ['TM Custom', ['High Noon'], ['spire-4']],
        ['Exodus Down', ['Repurposed Charge'], ['nessus-4']],
        ['Promised', ['Stable Resonance'], ['salvations-edge-2']],
        ["Atheon's Memory", ['Collective Power'], ['vog-4']],
        ['CODA', ['So Very Thin'], ['prophecy-4']],
        ["Legacy's Oath", ['Augmented Servos'], ['dsc-2']],
        ["Nezarec's Nightmare", ['Dream-Devourer'], ['ron-4']],
        ["Oryx's Memory", ['Iron Sharpens Iron', 'Ascendant Escape'], ['kf-4', 'kf-2']],
        ['AION Adapter', ['Force Absorption'], ['kepler-2']],
        ['Great Hunt', ['Taken Armaments'], ['last-wish-4']],
        ["Techeun's Regalia", ['Truth to Power'], ['shattered-throne-4']],
        ['Sage Protector', ['Combat Meditation'], ['equilibrium-2']],
        ["Crota's Memory", ['Power of the Son'], ['crota-4']]
    ])('matches %s to the expected source override ids', (name, bonusNames, expectedIds) => {
        const bonuses = bonusNames.map((bonusName, index) => bonus(index === 0 ? 2 : 4, bonusName));

        expect(getOpArmorSetBonuses({ name, bonuses }).map((opBonus) => opBonus.id)).toEqual(expectedIds);
    });
});

function bonus(requiredPieces: 2 | 4, name: string): ArmorSetBonusInfo {
    return {
        requiredPieces,
        name
    };
}
