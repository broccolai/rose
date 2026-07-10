import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';
import { CircleAlert } from 'lucide-solid';
import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

import { CustomSelect, SelectWrap } from '@/features/armor/components/calculator-control-primitives';
import { STAT_LABELS } from '@/features/armor/display-metadata';

interface DumpControlsProps {
    dumpStat: ArmorStat | '';
    onDumpStatChange: (stat: string) => void;
}

const InlineControls = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

const WarningHint = styled('span', {
    base: {
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        w: 'var(--rose-control-height)',
        h: 'var(--rose-control-height)',
        border: '1px solid color-mix(in srgb, var(--rose-warning) 52%, var(--rose-border))',
        borderRadius: 'var(--rose-radius-sm)',
        color: 'var(--rose-warning)',
        cursor: 'help',
        outline: 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-warning) 26%, transparent)',
            outlineOffset: '2px'
        }
    }
});

const WarningTooltip = styled('span', {
    base: {
        position: 'fixed',
        zIndex: 100,
        w: 'max-content',
        maxW: 'min(17rem, calc(100vw - 2rem))',
        px: 'var(--rose-space-sm)',
        py: 'var(--rose-space-xs)',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-text)',
        boxShadow: '0 12px 32px color-mix(in srgb, #000 32%, transparent)',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.35,
        textAlign: 'center',
        pointerEvents: 'none',
        transform: 'translateX(-50%)'
    }
});

export function DumpControls(props: DumpControlsProps) {
    let warningElement: HTMLSpanElement | undefined;
    const [warningHovered, setWarningHovered] = createSignal(false);
    const [warningFocused, setWarningFocused] = createSignal(false);
    const [tooltipPosition, setTooltipPosition] = createSignal({ top: 0, left: 0 });
    const tooltipVisible = () => warningHovered() || warningFocused();
    const updateTooltipPosition = () => {
        if (!warningElement || typeof window === 'undefined') {
            return;
        }

        const bounds = warningElement.getBoundingClientRect();
        setTooltipPosition({
            top: bounds.bottom + 8,
            left: Math.min(Math.max(bounds.left + bounds.width / 2, 150), window.innerWidth - 150)
        });
    };

    createEffect(() => {
        if (!tooltipVisible() || typeof window === 'undefined') {
            return;
        }

        updateTooltipPosition();
        window.addEventListener('resize', updateTooltipPosition);
        window.addEventListener('scroll', updateTooltipPosition, true);
        onCleanup(() => {
            window.removeEventListener('resize', updateTooltipPosition);
            window.removeEventListener('scroll', updateTooltipPosition, true);
        });
    });

    const options = () => [
        { value: '', label: 'None' },
        ...ARMOR_STATS.map((stat) => ({
            value: stat,
            label: STAT_LABELS[stat]
        }))
    ];

    return (
        <InlineControls>
            <SelectWrap>
                <CustomSelect
                    ariaLabel="Dump stat"
                    value={props.dumpStat}
                    options={options()}
                    intent={props.dumpStat ? 'default' : 'warning'}
                    onChange={props.onDumpStatChange}
                />
            </SelectWrap>
            <Show when={!props.dumpStat}>
                <WarningHint
                    ref={warningElement}
                    tabIndex={0}
                    aria-label="Performance warning"
                    aria-describedby="dump-stat-performance-warning"
                    onPointerEnter={() => setWarningHovered(true)}
                    onPointerLeave={() => setWarningHovered(false)}
                    onFocus={() => setWarningFocused(true)}
                    onBlur={() => setWarningFocused(false)}
                >
                    <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />
                </WarningHint>
                <Show when={tooltipVisible()}>
                    <Portal>
                        <WarningTooltip
                            id="dump-stat-performance-warning"
                            role="tooltip"
                            style={{ top: `${tooltipPosition().top}px`, left: `${tooltipPosition().left}px` }}
                        >
                            Choose a dump stat for much faster solving.
                        </WarningTooltip>
                    </Portal>
                </Show>
            </Show>
        </InlineControls>
    );
}
