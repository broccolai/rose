import { cva } from '@panda/css';
import { styled } from '@panda/jsx';
import type { JSX } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

export const FormRow = styled('label', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 'var(--rose-space-xxs)',
        alignItems: 'start',
        minW: 0
    }
});

export const RowLabel = styled('span', {
    base: {
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        lineHeight: 1,
        fontWeight: 680,
        color: 'var(--rose-muted)'
    }
});

export const SelectWrap = styled('div', {
    base: {
        w: { base: '100%', md: 'min(24rem, 100%)' },
        minW: 0
    }
});

const selectInputRecipe = cva({
    base: {
        w: '100%',
        minW: 0,
        boxSizing: 'border-box',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        colorScheme: 'inherit',
        cursor: 'pointer',
        fontFamily: MONO_FONT_FAMILY,
        lineHeight: 1.2,
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
        _focusVisible: {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-surface-raised)',
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            opacity: 0.42
        }
    },
    variants: {
        size: {
            default: {
                minH: 'var(--rose-control-height)',
                px: 'var(--rose-control-padding-x)',
                fontSize: '0.86rem'
            },
            compact: {
                minH: 'var(--rose-control-compact-height)',
                px: 'var(--rose-space-sm)',
                fontSize: '0.78rem'
            }
        }
    },
    defaultVariants: {
        size: 'default'
    }
});

export const SelectInput = styled('select', selectInputRecipe);

const controlButtonRecipe = cva({
    base: {
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        borderRadius: 'var(--rose-radius-sm)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        letterSpacing: 0,
        fontWeight: 720,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            transform: 'translateY(-1px)'
        },
        _disabled: {
            opacity: 0.55,
            cursor: 'not-allowed'
        }
    },
    variants: {
        intent: {
            primary: {
                border: '1px solid var(--rose-button)',
                bg: 'var(--rose-button)',
                color: 'var(--rose-button-text)',
                fontWeight: 760,
                _hover: {
                    bg: '#c292ff',
                    borderColor: '#c292ff'
                }
            },
            secondary: {
                border: '1px solid var(--rose-border)',
                bg: 'var(--rose-surface-soft)',
                color: 'var(--rose-text)',
                _hover: {
                    bg: 'var(--rose-surface-raised)',
                    color: 'var(--rose-text)',
                    borderColor: 'var(--rose-border-strong)'
                }
            },
            tonal: {
                border: '1px solid color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))',
                bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
                color: 'var(--rose-text)',
                boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--rose-text) 5%, transparent)',
                _hover: {
                    bg: 'color-mix(in srgb, var(--rose-accent) 14%, var(--rose-surface-raised))',
                    borderColor: 'color-mix(in srgb, var(--rose-accent) 52%, var(--rose-border))'
                },
                _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    _hover: {
                        bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
                        borderColor: 'color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))',
                        transform: 'none'
                    }
                }
            }
        }
    },
    defaultVariants: {
        intent: 'secondary'
    }
});

export const PrimaryButton = styled('button', controlButtonRecipe, {
    defaultProps: {
        intent: 'primary'
    }
});

export const SecondaryButton = styled('button', controlButtonRecipe, {
    defaultProps: {
        intent: 'secondary'
    }
});

export const TonalButton = styled('button', controlButtonRecipe, {
    defaultProps: {
        intent: 'tonal'
    }
});

export const ButtonGroup = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 'var(--rose-space-sm)',
        '& button': {
            minW: 0,
            whiteSpace: 'nowrap'
        }
    }
});

const compactChoiceRecipe = cva({
    base: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minW: '2.75rem',
        h: 'var(--rose-control-compact-height)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        px: 'var(--rose-space-sm)',
        py: 0,
        appearance: 'none',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        fontWeight: 760,
        lineHeight: 1,
        letterSpacing: 0,
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
        '&:not([data-disabled="true"])[data-selected="false"]:hover': {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        },
        '&[data-op="true"]': {
            color: 'color-mix(in srgb, var(--rose-op) 56%, var(--rose-muted) 44%)',
            bg: 'color-mix(in srgb, var(--rose-op) 8%, transparent)'
        },
        '&[data-disabled="true"]': {
            borderColor: 'var(--rose-control-disabled-border)',
            bg: 'var(--rose-control-disabled-bg)',
            color: 'var(--rose-control-disabled-text)',
            cursor: 'not-allowed',
            opacity: 0.72
        },
        '&[data-disabled="true"][data-op="true"]': {
            borderColor: 'color-mix(in srgb, var(--rose-op) 28%, var(--rose-control-disabled-border) 72%)',
            color: 'color-mix(in srgb, var(--rose-op) 24%, var(--rose-control-disabled-text) 76%)',
            bg: 'color-mix(in srgb, var(--rose-op) 6%, var(--rose-control-disabled-bg) 94%)'
        },
        '&[data-disabled="true"]::after': {
            content: '""',
            position: 'absolute',
            inset: '0.35rem',
            pointerEvents: 'none',
            bg: 'linear-gradient(to right bottom, transparent calc(50% - 0.5px), currentColor calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
            opacity: 0.34
        },
        '&[data-selected="true"]': {
            bg: 'var(--rose-button)',
            borderColor: 'var(--rose-button)',
            color: 'var(--rose-button-text)',
            boxShadow: 'none'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '2px'
        },
        '&:has(input:focus-visible)': {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '2px'
        },
        '& input': {
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer'
        }
    }
});

export const CompactChoiceButton = styled('button', compactChoiceRecipe);

export const CompactChoiceLabel = styled('label', compactChoiceRecipe);

const toggleBoxRecipe = cva({
    base: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '1.35rem',
        h: '1.35rem',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: '0.375rem',
        bg: 'var(--rose-surface)',
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 58%, var(--rose-border-strong))',
            bg: 'var(--rose-surface-raised)'
        },
        '&[data-selected="true"]': {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-accent)'
        },
        '&[data-selected="true"]::after': {
            content: '""',
            w: '0.5rem',
            h: '0.3rem',
            borderLeft: '2px solid #050508',
            borderBottom: '2px solid #050508',
            transform: 'translateY(-1px) rotate(-45deg)'
        },
        '&:has(input:focus-visible)': {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '2px'
        },
        '& input': {
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer'
        }
    }
});

export const ToggleBox = styled('span', toggleBoxRecipe);

const Section = styled('details', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        minW: 0,
        pt: 'var(--rose-space-sm)',
        borderTop: '1px solid var(--rose-border)',
        '& summary::-webkit-details-marker': {
            display: 'none'
        },
        '&[open]': {
            gap: 'var(--rose-space-xs)'
        },
        '&[open] [data-section-chevron]': {
            transform: 'rotate(45deg)'
        }
    }
});

const SectionSummary = styled('summary', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 'var(--rose-space-sm)',
        minW: 0,
        cursor: 'pointer',
        listStyle: 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '3px',
            borderRadius: 'var(--rose-radius-sm)'
        }
    }
});

const SectionBody = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        minW: 0,
        pt: 'var(--rose-space-xs)'
    }
});

const SectionChevron = styled('span', {
    base: {
        display: 'block',
        w: '0.48rem',
        h: '0.48rem',
        borderRight: '1.5px solid var(--rose-muted)',
        borderBottom: '1.5px solid var(--rose-muted)',
        transform: 'rotate(-45deg)',
        transition: 'transform 120ms ease, border-color 120ms ease'
    }
});

const SectionTitle = styled('h2', {
    base: {
        m: 0,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.9rem',
        lineHeight: 1,
        fontWeight: 760,
        color: 'var(--rose-text)'
    }
});

interface CollapsibleSectionProps {
    title: string;
    children: JSX.Element;
    defaultOpen?: boolean;
    ariaLabel?: string;
}

export function CollapsibleSection(props: CollapsibleSectionProps) {
    return (
        <Section open={props.defaultOpen ?? true} aria-label={props.ariaLabel ?? props.title}>
            <SectionSummary>
                <SectionTitle>{props.title}</SectionTitle>
                <SectionChevron data-section-chevron aria-hidden="true" />
            </SectionSummary>
            <SectionBody>{props.children}</SectionBody>
        </Section>
    );
}
