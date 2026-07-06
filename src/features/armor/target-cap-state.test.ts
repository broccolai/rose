import { describe, expect, test } from 'bun:test';

import {
    applyVerifiedTargetCap,
    clampTargetsToCaps,
    createPendingTargetCaps,
    MAX_STAT_TARGET_CAPS,
    snapStatTarget,
    statTargetMax,
    targetsAreWithinCaps
} from '@/features/armor/target-cap-state';

describe('target cap state', () => {
    test('pending caps preserve current requests but never exceed absolute bounds', () => {
        const pending = createPendingTargetCaps(
            {
                health: 90,
                melee: 250,
                grenade: 80,
                super: 180,
                class: Number.POSITIVE_INFINITY,
                weapons: 180
            },
            ''
        );

        expect(pending).toEqual({
            ...MAX_STAT_TARGET_CAPS,
            health: 90,
            melee: 200,
            grenade: 80,
            super: 180,
            class: 0,
            weapons: 180
        });
    });

    test('dump stat caps and targets are forced to zero', () => {
        const targets = {
            health: 40,
            melee: 40,
            grenade: 40,
            super: 40,
            class: 40,
            weapons: 40
        };

        expect(createPendingTargetCaps(targets, 'health').health).toBe(0);
        expect(applyVerifiedTargetCap(MAX_STAT_TARGET_CAPS, 'health', 200, 'health').health).toBe(0);
        expect(clampTargetsToCaps(targets, MAX_STAT_TARGET_CAPS, 'health')).toEqual({ ...targets, health: 0 });
    });

    test('verified caps sanitize worker output and clamp stale restored targets', () => {
        const caps = applyVerifiedTargetCap(MAX_STAT_TARGET_CAPS, 'health', 50.8, '');
        const targets = {
            health: 90,
            melee: 0,
            grenade: 80,
            super: 180,
            class: 0,
            weapons: 180
        };

        expect(caps.health).toBe(50);
        expect(targetsAreWithinCaps(targets, caps, '')).toBe(false);
        expect(clampTargetsToCaps(targets, caps, '')).toEqual({ ...targets, health: 50 });
    });

    test('snaps targets to five-point values when balanced tuning is disabled', () => {
        expect(snapStatTarget(181, 200, false)).toBe(180);
        expect(snapStatTarget(183, 200, false)).toBe(185);
        expect(snapStatTarget(198, 200, false)).toBe(200);
        expect(statTargetMax(143, false)).toBe(140);
        expect(snapStatTarget(143, 143, false)).toBe(140);
    });

    test('keeps one-point targets available when balanced tuning is enabled', () => {
        expect(snapStatTarget(181, 200, true)).toBe(181);
        expect(statTargetMax(143, true)).toBe(143);
        expect(clampTargetsToCaps({ ...MAX_STAT_TARGET_CAPS, health: 183 }, MAX_STAT_TARGET_CAPS, '', false).health).toBe(185);
    });
});
