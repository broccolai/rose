import { css } from '@panda/css';
import type { JSX } from 'solid-js';

import { panel } from '@/features/armor/components/ui-styles';

type ManualFrameProps = {
    children: JSX.Element;
};

type ManualPaneProps = {
    area: 'toolbar' | 'controls' | 'results';
    children: JSX.Element;
};

const pageFrame = css({
    position: 'relative',
    minH: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
    alignContent: 'start',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    bg: 'var(--rose-bg)',
    color: 'var(--rose-text)'
});

const manualSurface = css({
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateAreas: {
        base: '"toolbar" "controls" "results"',
        lg: '"toolbar toolbar" "controls results"'
    },
    gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: 'clamp(420px, 34vw, 540px) minmax(0, 1fr)' },
    gridTemplateRows: { base: 'max-content max-content max-content', lg: 'max-content minmax(0, 1fr)' },
    minH: '100vh',
    rowGap: 0,
    columnGap: 0,
    w: '100%',
    minW: 0,
    alignSelf: 'start',
    alignItems: 'start',
    overflow: 'visible',
    bg: 'var(--rose-bg)',
    p: 0
});

const paneAreas = {
    toolbar: css({
        gridArea: 'toolbar',
        borderBottom: '1px solid var(--rose-border)'
    }),
    controls: css({
        gridArea: 'controls',
        borderBottom: { base: '1px solid var(--rose-border)', lg: 0 },
        borderRight: { lg: '1px solid var(--rose-border)' },
        position: { lg: 'sticky' },
        top: { lg: 0 }
    }),
    results: css({
        gridArea: 'results'
    })
};

export function ManualPageFrame(props: ManualFrameProps) {
    return <main class={pageFrame}>{props.children}</main>;
}

export function ManualSurface(props: ManualFrameProps) {
    return <div class={manualSurface}>{props.children}</div>;
}

export function ManualPane(props: ManualPaneProps) {
    return <section class={`${panel} ${paneAreas[props.area]}`}>{props.children}</section>;
}
