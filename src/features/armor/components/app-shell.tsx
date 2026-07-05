import type { JSX } from 'solid-js';

import { ManualPageFrame, ManualPane, ManualSurface } from '@/features/armor/components/manual-frame';

type ArmorAppShellProps = {
    toolbar: JSX.Element;
    controls: JSX.Element;
    results: JSX.Element;
};

export function ArmorAppShell(props: ArmorAppShellProps) {
    return (
        <ManualPageFrame>
            <ManualSurface>
                <ManualPane area="toolbar">{props.toolbar}</ManualPane>
                <ManualPane area="controls">{props.controls}</ManualPane>
                <ManualPane area="results">{props.results}</ManualPane>
            </ManualSurface>
        </ManualPageFrame>
    );
}
