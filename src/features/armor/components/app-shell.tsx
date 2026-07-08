import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';
import { createSignal, Show } from 'solid-js';

import { ManualPageFrame, ManualPane, ManualSurface } from '@/features/armor/components/manual-frame';
import {
    OVERLAY_PANEL_STYLES,
    OVERLAY_STATUS_PILL_STYLES,
    OVERLAY_TITLE_STYLES,
    OverlayBackdrop
} from '@/features/armor/components/overlay-styles';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

type ArmorAppShellProps = {
    toolbar: JSX.Element;
    controls: JSX.Element;
    results: JSX.Element;
    locked?: boolean;
};

const LockedPaneContent = styled('div', {
    base: {
        display: 'contents',
        '&[data-locked="true"]': {
            '& section[data-lockable-pane="true"]': {
                opacity: 0.48,
                filter: 'blur(2px) saturate(0.82)',
                pointerEvents: 'none',
                userSelect: 'none'
            }
        }
    }
});

const LockOverlay = styled(OverlayBackdrop, {
    base: {
        position: 'relative',
        inset: 'auto',
        gridColumn: '1 / -1',
        gridRow: '2 / -1',
        alignSelf: 'stretch',
        justifySelf: 'stretch',
        zIndex: 5,
        p: { base: '1.25rem', md: '2rem' },
        pointerEvents: 'auto'
    }
});

const LockMessage = styled('div', {
    base: {
        display: 'grid',
        justifyItems: 'center',
        gap: '0.45rem',
        maxW: 'min(25rem, 100%)',
        px: { base: '1rem', md: '1.25rem' },
        py: { base: '0.9rem', md: '1rem' },
        textAlign: 'center',
        ...OVERLAY_PANEL_STYLES
    }
});

const LockTitle = styled('div', {
    base: {
        fontSize: { base: '0.98rem', md: '1.05rem' },
        ...OVERLAY_TITLE_STYLES
    }
});

const LockHint = styled('div', {
    base: {
        ...OVERLAY_STATUS_PILL_STYLES
    }
});

const ResultsWithCredits = styled('div', {
    base: {
        display: 'grid',
        gridTemplateRows: { lg: 'minmax(0, 1fr) auto' },
        gap: 'var(--rose-space-sm)',
        h: { lg: '100%' },
        minH: 0
    }
});

const CreditsRow = styled('div', {
    base: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        minH: '1.9rem',
        pt: 'var(--rose-space-xs)',
        borderTop: '1px solid var(--rose-border)'
    }
});

const CreditTextButton = styled('button', {
    base: {
        border: 0,
        bg: 'transparent',
        p: 0,
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.66rem',
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        cursor: 'pointer',
        transition: 'color 120ms ease',
        _hover: {
            color: 'var(--rose-accent)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '3px',
            borderRadius: '2px'
        }
    }
});

const CreditsOverlay = styled(OverlayBackdrop, {
    base: {
        zIndex: 90,
        p: '1rem'
    }
});

const CreditsPanel = styled('section', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-md)',
        w: 'min(24rem, 100%)',
        p: 'var(--rose-space-md)',
        textAlign: 'left',
        ...OVERLAY_PANEL_STYLES
    }
});

const CreditsTitle = styled('h2', {
    base: {
        m: 0,
        fontSize: '0.95rem',
        ...OVERLAY_TITLE_STYLES
    }
});

const CreditsList = styled('dl', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(5.5rem, auto) minmax(0, 1fr)',
        gap: '0.65rem var(--rose-space-md)',
        m: 0,
        p: 0,
        color: 'var(--rose-text)',
        fontSize: '0.82rem',
        lineHeight: 1.25,
        '& dt': {
            color: 'var(--rose-muted)',
            fontFamily: MONO_FONT_FAMILY,
            fontSize: '0.68rem',
            fontWeight: 700,
            textAlign: 'left',
            textTransform: 'uppercase'
        },
        '& dd': {
            m: 0,
            minW: 0,
            fontWeight: 700,
            color: 'var(--rose-text)',
            textAlign: 'right'
        }
    }
});

export function ArmorAppShell(props: ArmorAppShellProps) {
    const [creditsOpen, setCreditsOpen] = createSignal(false);

    return (
        <ManualPageFrame>
            <ManualSurface>
                <ManualPane area="toolbar">{props.toolbar}</ManualPane>
                <LockedPaneContent data-locked={props.locked}>
                    <ManualPane area="controls" lockable>
                        {props.controls}
                    </ManualPane>
                    <ManualPane area="results" lockable>
                        <ResultsWithCredits>
                            {props.results}
                            <CreditsRow>
                                <CreditTextButton type="button" onClick={() => setCreditsOpen(true)}>
                                    credits & thanks
                                </CreditTextButton>
                            </CreditsRow>
                        </ResultsWithCredits>
                    </ManualPane>
                </LockedPaneContent>
                <Show when={props.locked}>
                    <LockOverlay>
                        <LockMessage>
                            <LockTitle>Sign in to use the calculator.</LockTitle>
                            <LockHint>Connect Bungie in the top bar to unlock your vault.</LockHint>
                        </LockMessage>
                    </LockOverlay>
                </Show>
            </ManualSurface>
            <Show when={creditsOpen()}>
                <CreditsOverlay
                    role="presentation"
                    onClick={() => setCreditsOpen(false)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setCreditsOpen(false);
                        }
                    }}
                >
                    <CreditsPanel
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="rose-credits-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <CreditsTitle id="rose-credits-title">credits</CreditsTitle>
                        <CreditsList>
                            <dt>Author</dt>
                            <dd>broccoli</dd>
                            <dt>Thanks</dt>
                            <dd>the beast</dd>
                            <dt>Thanks</dt>
                            <dd>oyst</dd>
                            <dt>Thanks</dt>
                            <dd>euphoria</dd>
                            <dt>Thanks</dt>
                            <dd>d2-api-ts</dd>
                        </CreditsList>
                    </CreditsPanel>
                </CreditsOverlay>
            </Show>
        </ManualPageFrame>
    );
}
