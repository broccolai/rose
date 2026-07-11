import { cva } from '@panda/css';
import { styled } from '@panda/jsx';
import { CircleAlert, CircleHelp } from 'lucide-solid';
import { createEffect, createSignal, type JSX, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

interface HelpTooltipProps {
    label: string;
    children: JSX.Element;
    tone?: 'help' | 'warning' | undefined;
}

interface HoverTooltipProps {
    label: string;
    content: JSX.Element;
    children: JSX.Element;
}

const tooltipTriggerRecipe = cva({
    base: {
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        flex: '0 0 auto',
        p: 0,
        color: 'var(--rose-muted)',
        cursor: 'help',
        outline: 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        }
    },
    variants: {
        tone: {
            help: {
                w: '1.15rem',
                h: '1.15rem',
                border: 0,
                borderRadius: '50%',
                bg: 'transparent',
                _hover: {
                    color: 'var(--rose-text)'
                }
            },
            warning: {
                w: 'var(--rose-control-height)',
                h: 'var(--rose-control-height)',
                border: '1px solid color-mix(in srgb, var(--rose-warning) 52%, var(--rose-border))',
                borderRadius: 'var(--rose-radius-sm)',
                bg: 'transparent',
                color: 'var(--rose-warning)'
            }
        }
    },
    defaultVariants: {
        tone: 'help'
    }
});

const TooltipTrigger = styled('button', tooltipTriggerRecipe);

const TooltipPanel = styled('span', {
    base: {
        position: 'fixed',
        zIndex: 100,
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        w: 'max-content',
        maxW: 'min(19rem, calc(100vw - 2rem))',
        px: 'var(--rose-space-sm)',
        py: 'var(--rose-space-xs)',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-text)',
        boxShadow: '0 12px 32px color-mix(in srgb, #000 32%, transparent)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: '0.74rem',
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0,
        textAlign: 'left',
        pointerEvents: 'none',
        transform: 'translateX(-50%)'
    }
});

const HoverTooltipTrigger = styled('span', {
    base: {
        display: 'block',
        maxW: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'help',
        outline: 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        }
    }
});

const createTooltipState = () => {
    let triggerElement: HTMLElement | undefined;
    const [hovered, setHovered] = createSignal(false);
    const [focused, setFocused] = createSignal(false);
    const [position, setPosition] = createSignal({ top: 0, left: 0 });
    const visible = () => hovered() || focused();
    const updatePosition = () => {
        if (!triggerElement || typeof window === 'undefined') {
            return;
        }

        const bounds = triggerElement.getBoundingClientRect();
        setPosition({
            top: bounds.bottom + 8,
            left: Math.min(Math.max(bounds.left + bounds.width / 2, 160), window.innerWidth - 160)
        });
    };

    createEffect(() => {
        if (!visible() || typeof window === 'undefined') {
            return;
        }

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        onCleanup(() => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        });
    });

    return {
        setTriggerElement: (element: HTMLElement) => {
            triggerElement = element;
        },
        setHovered,
        setFocused,
        position,
        visible
    };
};

export const HelpTooltip = (props: HelpTooltipProps): JSX.Element => {
    const tooltip = createTooltipState();
    const tone = () => props.tone ?? 'help';

    return (
        <>
            <TooltipTrigger
                ref={tooltip.setTriggerElement}
                type="button"
                aria-label={props.label}
                tone={tone()}
                onPointerEnter={() => tooltip.setHovered(true)}
                onPointerLeave={() => tooltip.setHovered(false)}
                onFocus={() => tooltip.setFocused(true)}
                onBlur={() => tooltip.setFocused(false)}
            >
                <Show when={tone() === 'warning'} fallback={<CircleHelp size={14} strokeWidth={2} aria-hidden="true" />}>
                    <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />
                </Show>
            </TooltipTrigger>
            <Show when={tooltip.visible()}>
                <Portal>
                    <TooltipPanel role="tooltip" style={{ top: `${tooltip.position().top}px`, left: `${tooltip.position().left}px` }}>
                        {props.children}
                    </TooltipPanel>
                </Portal>
            </Show>
        </>
    );
};

export const HoverTooltip = (props: HoverTooltipProps): JSX.Element => {
    const tooltip = createTooltipState();

    return (
        <>
            <HoverTooltipTrigger
                ref={tooltip.setTriggerElement}
                tabIndex={0}
                aria-label={props.label}
                onPointerEnter={() => tooltip.setHovered(true)}
                onPointerLeave={() => tooltip.setHovered(false)}
                onFocus={() => tooltip.setFocused(true)}
                onBlur={() => tooltip.setFocused(false)}
            >
                {props.children}
            </HoverTooltipTrigger>
            <Show when={tooltip.visible()}>
                <Portal>
                    <TooltipPanel role="tooltip" style={{ top: `${tooltip.position().top}px`, left: `${tooltip.position().left}px` }}>
                        {props.content}
                    </TooltipPanel>
                </Portal>
            </Show>
        </>
    );
};
