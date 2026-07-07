import { ARMOR_SLOTS, type ArmorSlot } from '@armor-calc';
import { css } from '@panda/css';
import { For, Show } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { SLOT_LABELS } from '@/features/armor/display-metadata';

export type EquipPieceStatus = 'pending' | 'active' | 'done' | 'failed';

export type EquipProgressPiece = {
    slot: ArmorSlot;
    itemName: string;
    status: EquipPieceStatus;
    detail: string;
};

export type EquipProgressState = {
    active: boolean;
    title: string;
    detail: string;
    pieces: EquipProgressPiece[];
    canDismiss: boolean;
};

type EquipProgressOverlayProps = {
    progress: EquipProgressState | null;
    onDismiss: () => void;
};

const overlay = css({
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    p: { base: '1rem', md: '2rem' },
    bg: 'color-mix(in srgb, #030305 86%, transparent)',
    backdropFilter: 'blur(18px)'
});

const panel = css({
    w: 'min(920px, 100%)',
    border: '1px solid color-mix(in srgb, var(--rose-accent) 22%, var(--rose-border))',
    borderRadius: '1.1rem',
    bg: 'linear-gradient(180deg, color-mix(in srgb, var(--rose-surface-raised) 88%, #000 12%), var(--rose-surface))',
    boxShadow: '0 30px 110px color-mix(in srgb, #000 72%, transparent)',
    overflow: 'hidden'
});

const header = css({
    display: 'grid',
    gap: '0.45rem',
    p: { base: '1.1rem', md: '1.35rem 1.45rem' },
    borderBottom: '1px solid var(--rose-border)'
});

const title = css({
    m: 0,
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: { base: '1.05rem', md: '1.2rem' },
    fontWeight: 820,
    lineHeight: 1.05
});

const detail = css({
    color: 'var(--rose-muted-strong)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.8rem',
    lineHeight: 1.35
});

const body = css({
    display: 'grid',
    gap: '0.75rem',
    p: { base: '0.75rem', md: '1rem' }
});

const pieceCard = css({
    display: 'grid',
    gridTemplateColumns: '92px minmax(0, 1fr) auto',
    gap: '0.8rem',
    alignItems: 'center',
    minH: '58px',
    p: '0.8rem 0.9rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.85rem',
    bg: 'color-mix(in srgb, var(--rose-surface-soft) 70%, transparent)',
    transition: 'background-color 140ms ease, border-color 140ms ease',
    '&[data-status="active"]': {
        borderColor: 'color-mix(in srgb, var(--rose-accent) 64%, var(--rose-border))',
        bg: 'color-mix(in srgb, var(--rose-accent) 13%, var(--rose-surface-soft))'
    },
    '&[data-status="done"]': {
        borderColor: 'color-mix(in srgb, #46d37d 52%, var(--rose-border))',
        bg: 'color-mix(in srgb, #46d37d 10%, var(--rose-surface-soft))'
    },
    '&[data-status="failed"]': {
        borderColor: 'color-mix(in srgb, #ff5a72 60%, var(--rose-border))',
        bg: 'color-mix(in srgb, #ff5a72 12%, var(--rose-surface-soft))'
    },
    '@media (max-width: 620px)': {
        gridTemplateColumns: '1fr auto'
    }
});

const slotLabel = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.74rem',
    fontWeight: 760,
    '@media (max-width: 620px)': {
        display: 'none'
    }
});

const pieceMain = css({
    minW: 0,
    display: 'grid',
    gap: '0.22rem'
});

const pieceName = css({
    color: 'var(--rose-text)',
    fontSize: '0.9rem',
    fontWeight: 760,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
});

const pieceDetail = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.68rem',
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
});

const statusDot = css({
    w: '12px',
    h: '12px',
    borderRadius: '999px',
    bg: 'var(--rose-border)',
    boxShadow: '0 0 0 4px color-mix(in srgb, var(--rose-border) 18%, transparent)',
    '&[data-status="active"]': {
        bg: 'var(--rose-accent)',
        boxShadow: '0 0 0 4px color-mix(in srgb, var(--rose-accent) 22%, transparent)'
    },
    '&[data-status="done"]': {
        bg: '#46d37d',
        boxShadow: '0 0 0 4px color-mix(in srgb, #46d37d 22%, transparent)'
    },
    '&[data-status="failed"]': {
        bg: '#ff5a72',
        boxShadow: '0 0 0 4px color-mix(in srgb, #ff5a72 24%, transparent)'
    }
});

const footer = css({
    display: 'flex',
    justifyContent: 'flex-end',
    p: '0 1rem 1rem'
});

const dismissButton = css({
    minH: '38px',
    px: '1rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.7rem',
    bg: 'var(--rose-surface-soft)',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.76rem',
    fontWeight: 760,
    cursor: 'pointer',
    _hover: {
        bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))'
    }
});

export function EquipProgressOverlay(props: EquipProgressOverlayProps) {
    const orderedPieces = () => {
        const bySlot = new Map(props.progress?.pieces.map((piece) => [piece.slot, piece]) ?? []);
        return ARMOR_SLOTS.map((slot) => bySlot.get(slot)).filter((piece): piece is EquipProgressPiece => Boolean(piece));
    };

    return (
        <Show when={props.progress?.active}>
            <div class={overlay} role="status" aria-live="polite">
                <div class={panel}>
                    <div class={header}>
                        <h2 class={title}>{props.progress?.title}</h2>
                        <div class={detail}>{props.progress?.detail}</div>
                    </div>
                    <div class={body}>
                        <For each={orderedPieces()}>
                            {(piece) => (
                                <div class={pieceCard} data-status={piece.status}>
                                    <div class={slotLabel}>{SLOT_LABELS[piece.slot]}</div>
                                    <div class={pieceMain}>
                                        <div class={pieceName} title={piece.itemName}>
                                            {piece.itemName}
                                        </div>
                                        <div class={pieceDetail}>{piece.detail || 'Waiting'}</div>
                                    </div>
                                    <div class={statusDot} data-status={piece.status} />
                                </div>
                            )}
                        </For>
                    </div>
                    <Show when={props.progress?.canDismiss}>
                        <div class={footer}>
                            <button class={dismissButton} type="button" onClick={props.onDismiss}>
                                Dismiss
                            </button>
                        </div>
                    </Show>
                </div>
            </div>
        </Show>
    );
}
