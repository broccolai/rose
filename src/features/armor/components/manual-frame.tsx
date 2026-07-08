import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';

type ManualFrameProps = {
    children: JSX.Element;
};

type ManualPaneProps = {
    area: 'toolbar' | 'controls' | 'results';
    children: JSX.Element;
    lockable?: boolean;
};

const PageFrame = styled('main', {
    base: {
        position: 'relative',
        minH: { base: '100dvh', lg: '100dvh' },
        w: '100%',
        minW: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: 'minmax(0, 1fr)',
        boxSizing: 'border-box',
        overflow: { base: 'visible', lg: 'hidden' },
        bg: 'var(--rose-bg)',
        color: 'var(--rose-text)'
    }
});

const Surface = styled('div', {
    base: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateAreas: {
            base: '"toolbar" "controls" "results"',
            lg: '"toolbar toolbar" "controls results"'
        },
        gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: 'minmax(24rem, 28rem) minmax(0, 1fr)' },
        gridTemplateRows: { base: 'max-content max-content max-content', lg: 'max-content minmax(0, 1fr)' },
        h: { lg: '100dvh' },
        minH: { base: '100dvh', lg: 0 },
        rowGap: 0,
        columnGap: 0,
        w: '100%',
        minW: 0,
        alignSelf: 'stretch',
        alignItems: 'stretch',
        overflow: { base: 'visible', lg: 'hidden' },
        bg: 'var(--rose-bg)',
        p: 0
    }
});

const paneBase = {
    w: '100%',
    minW: 0,
    minH: 0,
    alignSelf: 'stretch',
    boxSizing: 'border-box',
    border: '0',
    borderRadius: '0',
    p: { base: 'var(--rose-space-md)', md: 'var(--rose-space-lg) var(--rose-space-xl)' },
    boxShadow: 'none'
} as const;

const ToolbarPane = styled('section', {
    base: {
        ...paneBase,
        gridArea: 'toolbar',
        alignSelf: 'start',
        borderBottom: '1px solid var(--rose-border)'
    }
});

const ControlsPane = styled('section', {
    base: {
        ...paneBase,
        gridArea: 'controls',
        display: 'grid',
        borderBottom: { base: '1px solid var(--rose-border)', lg: 0 },
        borderRight: { lg: '1px solid var(--rose-border)' },
        h: { lg: '100%' },
        overflow: { lg: 'hidden' }
    }
});

const ResultsPane = styled('section', {
    base: {
        ...paneBase,
        gridArea: 'results',
        h: { lg: '100%' },
        overflow: { lg: 'hidden' }
    }
});

export function ManualPageFrame(props: ManualFrameProps) {
    return <PageFrame>{props.children}</PageFrame>;
}

export function ManualSurface(props: ManualFrameProps) {
    return <Surface>{props.children}</Surface>;
}

export function ManualPane(props: ManualPaneProps) {
    const Pane = props.area === 'toolbar' ? ToolbarPane : props.area === 'controls' ? ControlsPane : ResultsPane;

    return <Pane data-lockable-pane={props.lockable}>{props.children}</Pane>;
}
