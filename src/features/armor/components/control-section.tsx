import type { JSX } from 'solid-js';

import { sectionStack, sectionTitle } from '@/features/armor/components/ui-styles';

type ControlSectionProps = {
    title: string;
    children: JSX.Element;
};

export function ControlSection(props: ControlSectionProps) {
    return (
        <div class={sectionStack}>
            <h2 class={sectionTitle}>{props.title}</h2>
            {props.children}
        </div>
    );
}
