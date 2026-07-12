import { ARMOR_SLOTS, type ArmorBuild, type ArmorSlot } from '@armor-domain';

import type { EquipPieceStatus, EquipProgressState } from '@/features/armor/components/equip-progress-overlay';

export interface EquipProgressUpdate {
    slot?: ArmorSlot;
    status?: EquipPieceStatus;
    detail: string;
}

export const createInitialEquipProgress = (build: ArmorBuild): EquipProgressState => ({
    active: true,
    title: 'Applying build',
    detail: 'Preparing armor changes',
    canDismiss: false,
    pieces: ARMOR_SLOTS.map((slot) => ({
        slot,
        itemName: build.pieces[slot].item.name,
        status: 'pending',
        detail: 'Waiting'
    }))
});

export const applyEquipProgressUpdate = (current: EquipProgressState | null, update: EquipProgressUpdate): EquipProgressState | null => {
    if (!current) {
        return current;
    }

    return {
        ...current,
        detail: update.detail,
        pieces: current.pieces.map((piece) =>
            piece.slot === update.slot
                ? {
                      ...piece,
                      status: update.status ?? piece.status,
                      detail: update.detail
                  }
                : piece
        )
    };
};

export const finishEquipProgress = (
    current: EquipProgressState | null,
    detail: string,
    failedSlot?: ArmorSlot
): EquipProgressState | null => {
    if (!current) {
        return current;
    }

    return {
        ...current,
        detail,
        canDismiss: true,
        pieces: current.pieces.map((piece) => ({
            ...piece,
            status: failedSlot && piece.slot === failedSlot ? 'failed' : piece.status
        }))
    };
};

export const markEquipProgressEquippingAll = (current: EquipProgressState | null): EquipProgressState | null =>
    current
        ? {
              ...current,
              detail: 'Equipping all armor pieces',
              pieces: current.pieces.map((piece) => ({
                  ...piece,
                  status: piece.status === 'failed' ? 'failed' : 'active',
                  detail: 'Equipping'
              }))
          }
        : current;

export const completeEquipProgress = (current: EquipProgressState | null): EquipProgressState | null =>
    current
        ? {
              ...current,
              detail: 'Build applied',
              canDismiss: true,
              pieces: current.pieces.map((piece) => ({
                  ...piece,
                  status: 'done',
                  detail: 'Done'
              }))
          }
        : current;
