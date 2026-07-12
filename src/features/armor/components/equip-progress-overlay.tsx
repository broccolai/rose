import { ARMOR_SLOTS, type ArmorSlot } from '@armor-domain';
import { styled } from '@panda/jsx';
import { For, Show } from 'solid-js';

import {
    OVERLAY_ACTION_BUTTON_STYLES,
    OVERLAY_PANEL_STYLES,
    OVERLAY_STATUS_PILL_STYLES,
    OVERLAY_TITLE_STYLES,
    OverlayBackdrop
} from '@/features/armor/components/overlay-styles';
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

const Overlay = styled(OverlayBackdrop, {
    base: {
        zIndex: 80,
        p: { base: '1rem', md: '2rem' }
    }
});

const Panel = styled('div', {
    base: {
        w: 'min(920px, 100%)',
        overflow: 'hidden',
        ...OVERLAY_PANEL_STYLES
    }
});

const Header = styled('div', {
    base: {
        display: 'grid',
        justifyItems: 'center',
        gap: '0.65rem',
        p: { base: '1.25rem 1.1rem', md: '1.6rem 1.45rem 1.35rem' },
        borderBottom: '1px solid var(--rose-border)'
    }
});

const Title = styled('h2', {
    base: {
        m: 0,
        fontSize: { base: '1.05rem', md: '1.16rem' },
        ...OVERLAY_TITLE_STYLES
    }
});

const Detail = styled('div', {
    base: {
        ...OVERLAY_STATUS_PILL_STYLES
    }
});

const Body = styled('div', {
    base: {
        display: 'grid',
        gap: '0.75rem',
        p: { base: '0.75rem', md: '1rem' }
    }
});

const PieceCard = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(4.75rem, max-content) minmax(0, 1fr) auto',
        gap: '0.8rem',
        alignItems: 'center',
        minH: '58px',
        p: '0.8rem 0.9rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 72%, transparent)',
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
    }
});

const SlotLabel = styled('div', {
    base: {
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        fontWeight: 700,
        '@media (max-width: 620px)': {
            display: 'none'
        }
    }
});

const PieceMain = styled('div', {
    base: {
        minW: 0,
        display: 'grid',
        gap: '0.22rem'
    }
});

const PieceName = styled('div', {
    base: {
        color: 'var(--rose-text)',
        fontSize: '0.9rem',
        fontWeight: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const PieceDetail = styled('div', {
    base: {
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem',
        lineHeight: 1.25,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const StatusDot = styled('div', {
    base: {
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
    }
});

const Footer = styled('div', {
    base: {
        display: 'flex',
        justifyContent: 'flex-end',
        p: '0 1rem 1rem'
    }
});

const DismissButton = styled('button', {
    base: {
        ...OVERLAY_ACTION_BUTTON_STYLES
    }
});

export function EquipProgressOverlay(props: EquipProgressOverlayProps) {
    const orderedPieces = () => {
        const bySlot = new Map(props.progress?.pieces.map((piece) => [piece.slot, piece]) ?? []);
        return ARMOR_SLOTS.map((slot) => bySlot.get(slot)).filter((piece): piece is EquipProgressPiece => Boolean(piece));
    };

    return (
        <Show when={props.progress?.active}>
            <Overlay role="status" aria-live="polite">
                <Panel>
                    <Header>
                        <Title>{props.progress?.title}</Title>
                        <Detail>{props.progress?.detail}</Detail>
                    </Header>
                    <Body>
                        <For each={orderedPieces()}>
                            {(piece) => (
                                <PieceCard data-status={piece.status}>
                                    <SlotLabel>{SLOT_LABELS[piece.slot]}</SlotLabel>
                                    <PieceMain>
                                        <PieceName title={piece.itemName}>{piece.itemName}</PieceName>
                                        <PieceDetail>{piece.detail || 'Waiting'}</PieceDetail>
                                    </PieceMain>
                                    <StatusDot data-status={piece.status} />
                                </PieceCard>
                            )}
                        </For>
                    </Body>
                    <Show when={props.progress?.canDismiss}>
                        <Footer>
                            <DismissButton type="button" onClick={props.onDismiss}>
                                Dismiss
                            </DismissButton>
                        </Footer>
                    </Show>
                </Panel>
            </Overlay>
        </Show>
    );
}
