import { styled } from '@panda/jsx';

import { PrimaryButton, SecondaryButton } from '@/features/armor/components/calculator-control-primitives';

interface ActionControlsProps {
    canSolve: boolean;
    solving: boolean;
    onSolve: () => void;
    onClearChoices: () => void;
}

const ActionStack = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 'var(--rose-space-sm)',
        pt: { base: 'var(--rose-space-xxs)', lg: 'var(--rose-space-md)' },
        borderTop: { lg: '1px solid var(--rose-border)' },
        bg: 'var(--rose-bg)',
        '& button': {
            minW: 0,
            whiteSpace: 'nowrap'
        }
    }
});

export function ActionControls(props: ActionControlsProps) {
    return (
        <ActionStack>
            <PrimaryButton type="button" onClick={props.onSolve} disabled={!props.canSolve || props.solving}>
                Solve Builds
            </PrimaryButton>
            <SecondaryButton type="button" onClick={props.onClearChoices}>
                Clear Choices
            </SecondaryButton>
        </ActionStack>
    );
}
