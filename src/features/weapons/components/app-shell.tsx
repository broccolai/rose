import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';

type WeaponAppShellProps = {
    toolbar: JSX.Element;
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
        gridTemplateAreas: '"toolbar" "editor" "analysis"',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: 'max-content max-content max-content',
        minH: '100dvh',
        w: '100%',
        minW: 0,
        '@media (min-width: 64rem)': {
            gridTemplateAreas: '"toolbar toolbar" "editor analysis"',
            gridTemplateColumns: 'minmax(0, 1fr) 21rem',
            gridTemplateRows: 'max-content minmax(0, 1fr)',
            h: '100dvh',
            overflow: 'hidden'
        },
        '@media (min-width: 90rem)': { gridTemplateColumns: 'minmax(0, 1fr) 23rem' }
    }
});

const ToolbarPane = styled('header', {
    base: {
        gridArea: 'toolbar',
        position: 'relative',
        zIndex: 20,
        minW: 0,
        p: { base: '0.7rem 0.85rem', md: '0.75rem 1rem' },
        borderBottom: '1px solid var(--rose-border)',
        bg: 'var(--rose-bg)'
    }
});

const EditorPane = styled('section', {
    base: {
        gridArea: 'editor',
        minW: 0,
        minH: 0,
        borderBottom: '1px solid var(--rose-border)',
        '@media (min-width: 64rem)': {
            overflow: 'auto',
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
        '@media (min-width: 64rem)': {
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
