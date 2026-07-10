import { cva } from '@panda/css';
import { styled } from '@panda/jsx';
import { createEffect, createMemo, createSignal, createUniqueId, For, type JSX, onCleanup, Show } from 'solid-js';

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
        fontWeight: 600,
        color: 'var(--rose-muted)'
    }
});

export const SelectWrap = styled('div', {
    base: {
        w: { base: '100%', md: 'min(24rem, 100%)' },
        minW: 0
    }
});

const customSelectTriggerRecipe = cva({
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 'var(--rose-space-sm)',
        w: '100%',
        minW: 0,
        boxSizing: 'border-box',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-text)',
        cursor: 'pointer',
        fontFamily: MONO_FONT_FAMILY,
        lineHeight: 1.2,
        textAlign: 'left',
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease, box-shadow 120ms ease',
        _hover: {
            bg: 'var(--rose-surface-raised)',
            borderColor: 'var(--rose-border-strong)'
        },
        _focusVisible: {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-surface-raised)',
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            cursor: 'not-allowed',
            opacity: 0.42,
            _hover: {
                bg: 'var(--rose-surface-soft)',
                borderColor: 'var(--rose-border)'
            }
        },
        '&[data-open="true"]': {
            bg: 'var(--rose-surface-raised)',
            borderColor: 'color-mix(in srgb, var(--rose-accent) 48%, var(--rose-border-strong))',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--rose-accent) 16%, transparent)'
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
        },
        intent: {
            default: {},
            warning: {
                borderColor: 'color-mix(in srgb, var(--rose-warning) 72%, var(--rose-border))',
                color: 'var(--rose-warning)',
                bg: 'color-mix(in srgb, var(--rose-warning) 8%, var(--rose-surface-soft))',
                _hover: {
                    borderColor: 'var(--rose-warning)',
                    bg: 'color-mix(in srgb, var(--rose-warning) 12%, var(--rose-surface-raised))'
                },
                _focusVisible: {
                    borderColor: 'var(--rose-warning)',
                    outline: '2px solid color-mix(in srgb, var(--rose-warning) 24%, transparent)'
                },
                '&[data-open="true"]': {
                    borderColor: 'var(--rose-warning)',
                    boxShadow: '0 0 0 1px color-mix(in srgb, var(--rose-warning) 14%, transparent)'
                }
            }
        }
    },
    defaultVariants: {
        size: 'default',
        intent: 'default'
    }
});

const CustomSelectRoot = styled('div', {
    base: {
        position: 'relative',
        w: '100%',
        minW: 0
    }
});

const CustomSelectTrigger = styled('button', customSelectTriggerRecipe);

const CustomSelectValue = styled('span', {
    base: {
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const CustomSelectChevron = styled('span', {
    base: {
        display: 'block',
        w: '0.48rem',
        h: '0.48rem',
        borderRight: '1.5px solid currentColor',
        borderBottom: '1.5px solid currentColor',
        color: 'var(--rose-muted-strong)',
        transform: 'rotate(45deg) translateY(-2px)',
        transition: 'transform 120ms ease',
        '[data-open="true"] &': {
            transform: 'rotate(225deg) translate(-2px, -1px)'
        }
    }
});

const CustomSelectList = styled('div', {
    base: {
        position: 'absolute',
        top: 'calc(100% + 0.35rem)',
        left: 0,
        right: 0,
        zIndex: 35,
        maxH: 'min(18rem, 46vh)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface)',
        boxShadow: '0 18px 45px color-mix(in srgb, #000 34%, transparent)',
        p: '0.25rem',
        scrollbarWidth: 'thin',
        scrollbarColor: 'color-mix(in srgb, var(--rose-muted) 42%, transparent) transparent'
    }
});

const CustomSelectOptionButton = styled('button', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        w: '100%',
        minH: '2rem',
        px: 'var(--rose-space-sm)',
        py: '0.42rem',
        border: 0,
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'transparent',
        color: 'var(--rose-muted-strong)',
        cursor: 'pointer',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.78rem',
        fontWeight: 600,
        lineHeight: 1.25,
        textAlign: 'left',
        transition: 'background-color 100ms ease, color 100ms ease',
        _hover: {
            bg: 'var(--rose-surface-soft)',
            color: 'var(--rose-text)'
        },
        _disabled: {
            cursor: 'not-allowed',
            opacity: 0.42,
            _hover: {
                bg: 'transparent',
                color: 'var(--rose-muted-strong)'
            }
        },
        '&[data-highlighted="true"]': {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        },
        '&[data-selected="true"]': {
            bg: 'color-mix(in srgb, var(--rose-accent) 18%, var(--rose-surface-raised))',
            color: 'var(--rose-text)'
        }
    }
});

export interface CustomSelectOption {
    value: string;
    label: string;
    disabled?: boolean | undefined;
}

export interface CustomSelectProps {
    value: string;
    options: readonly CustomSelectOption[];
    onChange: (value: string) => void;
    ariaLabel: string;
    disabled?: boolean | undefined;
    placeholder?: string | undefined;
    size?: 'default' | 'compact' | undefined;
    intent?: 'default' | 'warning' | undefined;
}

function nextSelectableIndex(options: readonly CustomSelectOption[], startIndex: number, direction: 1 | -1): number {
    if (options.length === 0) {
        return -1;
    }

    for (let offset = 0; offset < options.length; offset += 1) {
        const index = (startIndex + offset * direction + options.length) % options.length;
        if (!options[index]?.disabled) {
            return index;
        }
    }

    return -1;
}

export function CustomSelect(props: CustomSelectProps) {
    let rootElement: HTMLDivElement | undefined;
    const listId = createUniqueId();
    const [open, setOpen] = createSignal(false);
    const selectedIndex = createMemo(() => props.options.findIndex((option) => option.value === props.value));
    const selectedOption = createMemo(() => props.options[selectedIndex()]);
    const [highlightedIndex, setHighlightedIndex] = createSignal(-1);
    const visibleLabel = () => selectedOption()?.label ?? props.placeholder ?? 'Select';
    const openMenu = () => {
        if (props.disabled) {
            return;
        }

        setHighlightedIndex(nextSelectableIndex(props.options, Math.max(selectedIndex(), 0), 1));
        setOpen(true);
    };
    const closeMenu = () => setOpen(false);
    const moveHighlight = (direction: 1 | -1) => {
        const current = highlightedIndex() >= 0 ? highlightedIndex() + direction : Math.max(selectedIndex(), 0);
        const nextIndex = nextSelectableIndex(props.options, current, direction);

        if (nextIndex >= 0) {
            setHighlightedIndex(nextIndex);
        }
    };
    const chooseOption = (option: CustomSelectOption) => {
        if (option.disabled) {
            return;
        }

        props.onChange(option.value);
        closeMenu();
    };
    const handleTriggerKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open()) {
                openMenu();
                return;
            }

            moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open()) {
                openMenu();
                return;
            }

            const highlighted = props.options[highlightedIndex()];
            if (highlighted) {
                chooseOption(highlighted);
            }
            return;
        }

        if (event.key === 'Escape') {
            closeMenu();
        }
    };

    createEffect(() => {
        if (!open()) {
            return;
        }

        const closeOnPointerDown = (event: PointerEvent) => {
            if (!rootElement?.contains(event.target as Node)) {
                closeMenu();
            }
        };

        document.addEventListener('pointerdown', closeOnPointerDown);
        onCleanup(() => document.removeEventListener('pointerdown', closeOnPointerDown));
    });

    return (
        <CustomSelectRoot ref={rootElement}>
            <CustomSelectTrigger
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open()}
                aria-controls={listId}
                aria-label={props.ariaLabel}
                disabled={props.disabled}
                data-open={open()}
                size={props.size}
                intent={props.intent}
                onClick={() => (open() ? closeMenu() : openMenu())}
                onKeyDown={handleTriggerKeyDown}
            >
                <CustomSelectValue>{visibleLabel()}</CustomSelectValue>
                <CustomSelectChevron aria-hidden="true" />
            </CustomSelectTrigger>
            <Show when={open()}>
                <CustomSelectList id={listId} role="listbox" aria-label={props.ariaLabel}>
                    <For each={props.options}>
                        {(option, index) => (
                            <CustomSelectOptionButton
                                type="button"
                                role="option"
                                aria-selected={option.value === props.value}
                                disabled={option.disabled}
                                data-highlighted={highlightedIndex() === index()}
                                data-selected={option.value === props.value}
                                onPointerEnter={() => setHighlightedIndex(index())}
                                onClick={() => chooseOption(option)}
                            >
                                {option.label}
                            </CustomSelectOptionButton>
                        )}
                    </For>
                </CustomSelectList>
            </Show>
        </CustomSelectRoot>
    );
}

const controlButtonRecipe = cva({
    base: {
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        borderRadius: 'var(--rose-radius-sm)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        letterSpacing: 0,
        fontWeight: 700,
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
                fontWeight: 700,
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
        fontWeight: 700,
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
        fontWeight: 700,
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
