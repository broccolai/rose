import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

type ControlSectionProps = {
    title: string;
    children: JSX.Element;
};

const SectionStack = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        pb: 'var(--rose-space-sm)',
        borderBottom: '1px solid var(--rose-border)',
        _last: {
            pb: 0,
            borderBottom: 0
        }
    }
});

const SectionTitle = styled('h2', {
    base: {
        m: 0,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.86rem',
        lineHeight: 1,
        letterSpacing: 0,
        fontWeight: 720,
        color: 'var(--rose-text)'
    }
});

export function ControlSection(props: ControlSectionProps) {
    return (
        <SectionStack>
            <SectionTitle>{props.title}</SectionTitle>
            {props.children}
        </SectionStack>
    );
}
