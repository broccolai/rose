import { css } from '@panda/css';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { ManualPageFrame, ManualPane, ManualSurface } from '@/features/armor/components/manual-frame';

type ArmorAppShellProps = {
    toolbar: JSX.Element;
    controls: JSX.Element;
    results: JSX.Element;
    locked?: boolean;
};

const lockedPaneContent = css({
    display: 'contents',
    '&[data-locked="true"]': {
        '& section[data-lockable-pane="true"]': {
            opacity: 0.32,
            filter: 'grayscale(0.85)',
            pointerEvents: 'none',
            userSelect: 'none'
        }
    }
});

const lockOverlay = css({
    gridColumn: '1 / -1',
    gridRow: '2 / -1',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    zIndex: 5,
    display: 'grid',
    placeItems: 'start center',
    pt: '4rem',
    bg: 'color-mix(in srgb, var(--rose-bg) 34%, transparent)',
    color: 'var(--rose-muted)',
    fontSize: '0.82rem',
    fontWeight: 720,
    pointerEvents: 'auto'
});

export function ArmorAppShell(props: ArmorAppShellProps) {
    return (
        <ManualPageFrame>
            <ManualSurface>
                <ManualPane area="toolbar">{props.toolbar}</ManualPane>
                <div class={lockedPaneContent} data-locked={props.locked}>
                    <ManualPane area="controls" lockable>
                        {props.controls}
                    </ManualPane>
                    <ManualPane area="results" lockable>
                        {props.results}
                    </ManualPane>
                </div>
                <Show when={props.locked}>
                    <div class={lockOverlay}>Sign in to use the calculator.</div>
                </Show>
            </ManualSurface>
        </ManualPageFrame>
    );
}
