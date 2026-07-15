import { styled } from '@panda/jsx';

export const SectionHeading = styled('h2', {
    base: {
        m: 0,
        color: 'var(--rose-muted-strong)',
        fontSize: '0.69rem',
        fontWeight: 800,
        letterSpacing: 0,
        lineHeight: 1.1,
        textTransform: 'uppercase'
    }
});

export const MutedText = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.72rem',
        lineHeight: 1.3
    }
});

export const IconButton = styled('button', {
    base: {
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        w: 'var(--rose-control-compact-height)',
        h: 'var(--rose-control-compact-height)',
        p: 0,
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted-strong)',
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease',
        _hover: {
            bg: 'var(--rose-surface-raised)',
            borderColor: 'var(--rose-border-strong)',
            color: 'var(--rose-text)',
            transform: 'translateY(-1px)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 38%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            opacity: 0.45,
            cursor: 'not-allowed',
            transform: 'none'
        },
        '& svg': {
            w: '1rem',
            h: '1rem',
            strokeWidth: 2
        }
    }
});

export const TextInput = styled('input', {
    base: {
        w: '100%',
        minW: 0,
        h: 'var(--rose-control-compact-height)',
        px: '0.7rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        fontSize: '0.78rem',
        outline: 'none',
        _placeholder: { color: 'var(--rose-muted)' },
        _focus: {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 62%, var(--rose-border-strong))',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--rose-accent) 12%, transparent)'
        }
    }
});

export const SelectInput = styled('select', {
    base: {
        w: '100%',
        minW: 0,
        h: 'var(--rose-control-compact-height)',
        px: '0.6rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        fontSize: '0.72rem',
        outline: 'none',
        _focus: {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 62%, var(--rose-border-strong))'
        }
    }
});

export const NumberInput = styled('input', {
    base: {
        w: '4.75rem',
        h: '2rem',
        px: '0.45rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        fontSize: '0.75rem',
        fontVariantNumeric: 'tabular-nums',
        outline: 'none',
        _focus: { borderColor: 'var(--rose-accent)' }
    }
});

export const SegmentedControl = styled('div', {
    base: {
        display: 'inline-grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        gap: '2px',
        p: '2px',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)'
    }
});

export const SegmentButton = styled('button', {
    base: {
        minW: '3.4rem',
        h: '1.7rem',
        px: '0.55rem',
        border: 0,
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'transparent',
        color: 'var(--rose-muted)',
        fontSize: '0.68rem',
        fontWeight: 800,
        lineHeight: 1,
        transition: 'background-color 120ms ease, color 120ms ease',
        _hover: { color: 'var(--rose-text)' },
        '&[aria-pressed="true"]': {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)',
            boxShadow: 'inset 0 -2px 0 var(--rose-accent)'
        }
    }
});
