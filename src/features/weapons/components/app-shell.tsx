import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';

type WeaponAppShellProps = {
    toolbar: JSX.Element;
    explorer: JSX.Element;
    editor: JSX.Element;
    analysis: JSX.Element;
};

const Page = styled('main', {
    base: {
        minH: '100dvh',
        w: '100%',
        minW: 0,
        bg: 'var(--rose-bg)',
        color: 'var(--rose-text)'
    }
});

const Surface = styled('div', {
    base: {
        display: 'grid',
        gridTemplateAreas: '"toolbar" "explorer" "editor" "analysis"',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: 'max-content max-content max-content max-content',
        minH: '100dvh',
        w: '100%',
        minW: 0,
        '@media (min-width: 48rem)': {
            gridTemplateAreas: '"toolbar toolbar" "explorer editor" "analysis analysis"',
            gridTemplateColumns: '18rem minmax(0, 1fr)',
            gridTemplateRows: 'max-content minmax(0, 1fr) max-content',
            h: '100dvh',
            overflow: 'hidden'
        },
        '@media (min-width: 80rem)': {
            gridTemplateAreas: '"toolbar toolbar toolbar" "explorer editor analysis"',
            gridTemplateColumns: '20rem minmax(30rem, 1fr) 22rem',
            gridTemplateRows: 'max-content minmax(0, 1fr)'
        },
        '@media (min-width: 112rem)': {
            gridTemplateColumns: '23rem minmax(38rem, 1fr) 25rem'
        }
    }
});

const ToolbarPane = styled('header', {
    base: {
        gridArea: 'toolbar',
        position: 'relative',
        zIndex: 20,
        minW: 0,
        p: { base: '0.75rem 1rem', md: '0.8rem 1.25rem' },
        borderBottom: '1px solid var(--rose-border)',
        bg: 'var(--rose-bg)'
    }
});

const ExplorerPane = styled('aside', {
    base: {
        gridArea: 'explorer',
        minW: 0,
        minH: 0,
        borderBottom: '1px solid var(--rose-border)',
        '@media (min-width: 48rem)': {
            borderRight: '1px solid var(--rose-border)',
            overflow: 'hidden'
        },
        '@media (min-width: 80rem)': {
            borderBottom: 0
        }
    }
});

const EditorPane = styled('section', {
    base: {
        gridArea: 'editor',
        minW: 0,
        minH: 0,
        borderBottom: '1px solid var(--rose-border)',
        '@media (min-width: 48rem)': {
            overflow: 'auto'
        },
        '@media (min-width: 80rem)': {
            borderRight: '1px solid var(--rose-border)',
            borderBottom: 0
        }
    }
});

const AnalysisPane = styled('aside', {
    base: {
        gridArea: 'analysis',
        minW: 0,
        minH: 0,
        '@media (min-width: 48rem)': {
            maxH: '42dvh',
            overflow: 'auto'
        },
        '@media (min-width: 80rem)': {
            maxH: 'none',
            overflow: 'auto'
        }
    }
});

export function WeaponAppShell(props: WeaponAppShellProps) {
    return (
        <Page>
            <Surface>
                <ToolbarPane>{props.toolbar}</ToolbarPane>
                <ExplorerPane aria-label="Weapon arsenal">{props.explorer}</ExplorerPane>
                <EditorPane id="weapon-editor" aria-label="Roll editor" tabIndex={-1}>
                    {props.editor}
                </EditorPane>
                <AnalysisPane id="weapon-analysis" aria-label="Weapon analysis" tabIndex={-1}>
                    {props.analysis}
                </AnalysisPane>
            </Surface>
        </Page>
    );
}
