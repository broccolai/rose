import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { ManualPageFrame, ManualPane, ManualSurface } from '@/features/armor/components/manual-frame';
import {
    OVERLAY_BACKDROP_STYLES,
    OVERLAY_PANEL_STYLES,
    OVERLAY_STATUS_PILL_STYLES,
    OVERLAY_TITLE_STYLES
} from '@/features/armor/components/overlay-styles';

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

const LockOverlay = styled('div', {
    base: {
        gridColumn: '1 / -1',
        gridRow: '2 / -1',
        alignSelf: 'stretch',
        justifySelf: 'stretch',
        zIndex: 5,
        display: 'grid',
        placeItems: 'center',
        p: { base: '1.25rem', md: '2rem' },
        pointerEvents: 'auto',
        ...OVERLAY_BACKDROP_STYLES
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

export function ArmorAppShell(props: ArmorAppShellProps) {
    return (
        <ManualPageFrame>
            <ManualSurface>
                <ManualPane area="toolbar">{props.toolbar}</ManualPane>
                <LockedPaneContent data-locked={props.locked}>
                    <ManualPane area="controls" lockable>
                        {props.controls}
                    </ManualPane>
                    <ManualPane area="results" lockable>
                        {props.results}
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
        </ManualPageFrame>
    );
}
