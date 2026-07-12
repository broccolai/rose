import { ARMOR_SLOTS, type ArmorStatTargetCapsInput, type SolveArmorInput } from '@armor-domain';

export const AUTH_LOCK_DISABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';
export const DEV_TIMING = import.meta.env.DEV;

export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
    );
};

export const isLocalDevHost = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

export const canLoadLocalTestData = (): boolean => AUTH_LOCK_DISABLED || isLocalDevHost();

export const elapsedMs = (startedAt: number): number => Math.round((performance.now() - startedAt) * 10) / 10;

export const logDevTiming = (label: string, details: Record<string, unknown>): void => {
    if (!DEV_TIMING) {
        return;
    }

    console.debug(`[rose timing] ${label}`, details);
};

export const armorSlotCounts = (input: ArmorStatTargetCapsInput | SolveArmorInput): Record<string, number> =>
    Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, input.armor[slot].length]));
