import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';
import { createEffect, createSignal, For } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { snapStatTarget, statTargetMax, statTargetStep } from '@/features/armor/target-cap-state';

const MAX_STAT_TARGET = 200;
const STAT_SCALE_VALUES = [0, 25, 50, 75, 100, 125, 150, 175, 200] as const;

interface StatTargetFieldsProps {
    allowBalancedTuning: boolean;
    dumpStat: ArmorStat | '';
    targets: StatVector;
    targetCaps: StatVector;
    targetCapsPending: boolean;
    onTargetChange: (stat: ArmorStat, value: string) => void;
}

const FieldLabel = styled('span', {
    base: {
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.76rem',
        lineHeight: 1,
        letterSpacing: 0,
        fontWeight: 650,
        color: 'var(--rose-muted)'
    }
});

const StatGrid = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)'
    }
});

const StatSliderRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateAreas: '"name value" "slider slider"',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 'var(--rose-space-xxs) var(--rose-space-sm)',
        alignItems: 'center',
        py: 0,
        minW: 0
    }
});

const StatScaleRow = styled('div', {
    base: {
        display: { base: 'none', md: 'grid' },
        gridTemplateColumns: 'minmax(0, 1fr)',
        alignItems: 'center',
        minW: 0
    }
});

const StatScale = styled('div', {
    base: {
        position: 'relative',
        h: '1rem',
        mx: '7px',
        minW: 0
    }
});

const StatScaleNumber = styled('span', {
    base: {
        position: 'absolute',
        left: 'var(--stat-scale-left)',
        transform: 'translateX(-50%)',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        '&[data-major="true"]': {
            color: 'var(--rose-text)',
            fontSize: '0.76rem',
            fontWeight: 750
        }
    }
});

const StatSliderFrame = styled('div', {
    base: {
        gridArea: 'slider',
        position: 'relative',
        display: 'grid',
        alignItems: 'center',
        h: 'var(--rose-control-compact-height)',
        minW: 0,
        '--stat-tick-color': 'rgba(244, 244, 245, 0.34)',
        '--stat-major-color': 'rgba(244, 244, 245, 0.92)'
    }
});

const StatSliderName = styled(FieldLabel, {
    base: {
        gridArea: 'name',
        minW: 0
    }
});

const StatSliderTrack = styled('div', {
    base: {
        position: 'relative',
        zIndex: 1,
        w: '100%',
        minW: 0,
        h: '24px',
        appearance: 'none',
        bg: 'transparent',
        cursor: 'pointer',
        touchAction: 'none',
        '--stat-track-height': '4px',
        '--stat-track-radius': '999px',
        '--stat-track-border': '1px solid var(--rose-border)',
        '--stat-track-bg':
            'linear-gradient(var(--stat-major-color), var(--stat-major-color)) 50% center / 2px 12px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 12.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 25% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 37.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 62.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 75% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 87.5% center / 1px 7px no-repeat, linear-gradient(to right, var(--rose-accent) 0 var(--stat-value-percent), var(--rose-info) var(--stat-value-percent) var(--stat-cap-percent), transparent var(--stat-cap-percent) 100%) center / 100% 100% no-repeat, repeating-linear-gradient(135deg, #24242a 0 5px, #1b1b20 5px 10px) center / 100% 100% no-repeat',
        '--stat-thumb-size': '14px',
        '--stat-thumb-half': 'calc(var(--stat-thumb-size) / 2)',
        '--stat-thumb-radius': '999px',
        '--stat-thumb-border': '0',
        '--stat-thumb-bg': 'var(--rose-accent)',
        '--stat-thumb-shadow': 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '3px',
            borderRadius: '999px'
        },
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 'var(--stat-thumb-half)',
            right: 'var(--stat-thumb-half)',
            top: '50%',
            transform: 'translateY(-50%)',
            h: 'var(--stat-track-height)',
            borderRadius: 'var(--stat-track-radius)',
            bg: 'var(--stat-track-bg)',
            border: 'var(--stat-track-border)'
        },
        '&[data-dragging="true"]': {
            cursor: 'grabbing'
        },
        '&[data-disabled="true"]': {
            opacity: 0.35,
            cursor: 'not-allowed'
        },
        '&[data-pending="true"]': {
            opacity: 0.62,
            cursor: 'progress'
        }
    }
});

const StatSliderThumb = styled('span', {
    base: {
        position: 'absolute',
        zIndex: 2,
        left: 'clamp(var(--stat-thumb-half), var(--stat-value-percent), calc(100% - var(--stat-thumb-half)))',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        w: 'var(--stat-thumb-size)',
        h: 'var(--stat-thumb-size)',
        borderRadius: 'var(--stat-thumb-radius)',
        border: 'var(--stat-thumb-border)',
        bg: 'var(--stat-thumb-bg)',
        boxShadow: 'var(--stat-thumb-shadow)',
        pointerEvents: 'none'
    }
});

const StatValue = styled('span', {
    base: {
        gridArea: 'value',
        justifySelf: 'end',
        fontFamily: MONO_FONT_FAMILY,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--rose-text)',
        fontSize: '0.86rem',
        fontWeight: 680
    }
});

const StatCap = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.68rem'
    }
});

interface StatTargetSliderProps {
    allowBalancedTuning: boolean;
    cap: number;
    disabled: boolean;
    label: string;
    pending: boolean;
    stat: ArmorStat;
    value: number;
    onCommit: (stat: ArmorStat, value: string) => void;
}

const percent = (value: number): number => Math.max(0, Math.min(100, (value / MAX_STAT_TARGET) * 100));

function StatTargetSlider(props: StatTargetSliderProps) {
    const maxValue = () => statTargetMax(props.cap, props.allowBalancedTuning);
    const committedValue = () => snapStatTarget(props.value, props.cap, props.allowBalancedTuning);
    const [draftValue, setDraftValue] = createSignal(committedValue());
    const [draggingPointerId, setDraggingPointerId] = createSignal<number | null>(null);

    createEffect(() => {
        setDraftValue(committedValue());
    });

    const clampDraft = (value: string | number) => snapStatTarget(Number(value) || 0, props.cap, props.allowBalancedTuning);

    const valueFromPointer = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const thumbInset = 7;
        const left = bounds.left + thumbInset;
        const width = Math.max(1, bounds.width - thumbInset * 2);
        const ratio = Math.max(0, Math.min(1, (event.clientX - left) / width));
        return clampDraft(Math.round(ratio * MAX_STAT_TARGET));
    };

    const commit = (value: string | number = draftValue()) => {
        const nextValue = clampDraft(value);
        setDraftValue(nextValue);

        if (nextValue !== props.value) {
            props.onCommit(props.stat, String(nextValue));
        }
    };

    const startDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (props.disabled || props.pending || maxValue() <= 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingPointerId(event.pointerId);
        setDraftValue(valueFromPointer(event));
    };

    const drag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        event.preventDefault();
        setDraftValue(valueFromPointer(event));
    };

    const finishDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        event.preventDefault();
        const nextValue = valueFromPointer(event);
        setDraggingPointerId(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        commit(nextValue);
    };

    const cancelDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        setDraggingPointerId(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDraftValue(committedValue());
    };

    const commitKeyboardChange = (event: KeyboardEvent) => {
        if (props.disabled || props.pending || maxValue() <= 0) {
            return;
        }

        const step = statTargetStep(props.allowBalancedTuning);
        const keyDeltas: Record<string, number> = {
            ArrowDown: -step,
            ArrowLeft: -step,
            ArrowRight: step,
            ArrowUp: step,
            PageDown: -step * 5,
            PageUp: step * 5
        };
        const currentValue = draftValue();
        let nextValue: number | null = null;

        if (event.key in keyDeltas) {
            nextValue = currentValue + keyDeltas[event.key];
        } else if (event.key === 'Home') {
            nextValue = 0;
        } else if (event.key === 'End') {
            nextValue = maxValue();
        }

        if (nextValue !== null) {
            event.preventDefault();
            commit(nextValue);
        }
    };

    return (
        <StatSliderRow>
            <StatSliderName>{props.label}</StatSliderName>
            <StatSliderFrame>
                <StatSliderTrack
                    role="slider"
                    style={`--stat-value-percent: ${percent(draftValue())}%; --stat-cap-percent: ${percent(maxValue())}%;`}
                    aria-disabled={props.disabled || maxValue() <= 0}
                    aria-label={props.label}
                    aria-valuemax={maxValue()}
                    aria-valuemin={0}
                    aria-valuenow={draftValue()}
                    aria-busy={props.pending}
                    data-disabled={props.disabled || props.pending || maxValue() <= 0}
                    data-dragging={draggingPointerId() !== null}
                    data-pending={props.pending}
                    tabIndex={props.disabled || props.pending || maxValue() <= 0 ? -1 : 0}
                    onBlur={() => {
                        setDraggingPointerId(null);
                        commit(draftValue());
                    }}
                    onKeyDown={commitKeyboardChange}
                    onPointerCancel={cancelDrag}
                    onPointerDown={startDrag}
                    onPointerMove={drag}
                    onPointerUp={finishDrag}
                >
                    <StatSliderThumb />
                </StatSliderTrack>
            </StatSliderFrame>
            <StatValue>
                {draftValue()} <StatCap>/ {props.pending ? 'checking' : maxValue()}</StatCap>
            </StatValue>
        </StatSliderRow>
    );
}

export function StatTargetFields(props: StatTargetFieldsProps) {
    return (
        <StatGrid>
            <StatScaleRow aria-hidden="true">
                <StatScale>
                    <For each={STAT_SCALE_VALUES}>
                        {(value) => (
                            <StatScaleNumber data-major={value === 100} style={`--stat-scale-left: ${percent(value)}%;`}>
                                {value}
                            </StatScaleNumber>
                        )}
                    </For>
                </StatScale>
            </StatScaleRow>
            <For each={ARMOR_STATS}>
                {(stat) => {
                    const cap = () => (props.dumpStat === stat ? 0 : props.targetCaps[stat]);
                    const value = () => Math.min(props.targets[stat], cap());

                    return (
                        <StatTargetSlider
                            allowBalancedTuning={props.allowBalancedTuning}
                            cap={cap()}
                            disabled={props.dumpStat === stat}
                            label={STAT_LABELS[stat]}
                            pending={props.targetCapsPending}
                            stat={stat}
                            value={value()}
                            onCommit={props.onTargetChange}
                        />
                    );
                }}
            </For>
        </StatGrid>
    );
}
