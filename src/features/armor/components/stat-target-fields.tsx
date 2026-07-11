import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';
import { createEffect, createSignal, For, Show } from 'solid-js';

import { HelpTooltip } from '@/features/armor/components/help-tooltip';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { armorStatEffectsAt } from '@/features/armor/stat-effects';
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
        fontSize: '0.72rem',
        lineHeight: 1,
        letterSpacing: 0,
        fontWeight: 600,
        color: 'var(--rose-muted)'
    }
});

const StatGrid = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)'
    }
});

const StatSliderRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateAreas: '"name value" "slider slider"',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '0.2rem var(--rose-space-xs)',
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
        h: '0.85rem',
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
            fontWeight: 700
        }
    }
});

const StatSliderFrame = styled('div', {
    base: {
        gridArea: 'slider',
        position: 'relative',
        display: 'grid',
        alignItems: 'center',
        h: '1.7rem',
        minW: 0,
        '--stat-tick-color': 'var(--rose-slider-tick)',
        '--stat-major-color': 'var(--rose-slider-major)'
    }
});

const StatSliderName = styled(FieldLabel, {
    base: {
        gridArea: 'name',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xxs)',
        minW: 0
    }
});

const StatEffectContent = styled('span', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

const StatEffectHeading = styled('strong', {
    base: {
        color: 'var(--rose-text)',
        fontSize: '0.78rem',
        fontWeight: 700
    }
});

const StatEffectList = styled('span', {
    base: {
        display: 'grid',
        gap: '0.3rem'
    }
});

const StatEffectRow = styled('span', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
        gap: 'var(--rose-space-sm)',
        alignItems: 'start'
    }
});

const StatEffectLabel = styled('span', {
    base: {
        color: 'var(--rose-muted)'
    }
});

const StatEffectValue = styled('span', {
    base: {
        color: 'var(--rose-text)',
        fontWeight: 600,
        textAlign: 'right'
    }
});

const StatEffectNote = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.68rem'
    }
});

const StatSliderTrack = styled('div', {
    base: {
        position: 'relative',
        zIndex: 1,
        w: '100%',
        minW: 0,
        h: '20px',
        appearance: 'none',
        bg: 'transparent',
        cursor: 'pointer',
        touchAction: 'none',
        '--stat-track-height': '4px',
        '--stat-track-radius': '999px',
        '--stat-track-border': '1px solid var(--rose-border)',
        '--stat-track-bg':
            'linear-gradient(var(--stat-major-color), var(--stat-major-color)) 50% center / 2px 12px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 12.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 25% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 37.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 62.5% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 75% center / 1px 7px no-repeat, linear-gradient(var(--stat-tick-color), var(--stat-tick-color)) 87.5% center / 1px 7px no-repeat, linear-gradient(to right, var(--rose-accent) 0 var(--stat-value-percent), var(--rose-slider-cap) var(--stat-value-percent) var(--stat-cap-percent), transparent var(--stat-cap-percent) 100%) center / 100% 100% no-repeat, repeating-linear-gradient(135deg, var(--rose-slider-empty-a) 0 5px, var(--rose-slider-empty-b) 5px 10px) center / 100% 100% no-repeat',
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
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.12rem',
        fontFamily: MONO_FONT_FAMILY,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--rose-text)',
        fontSize: '0.82rem',
        fontWeight: 600
    }
});

const StatValueInput = styled('input', {
    base: {
        w: '2.2rem',
        minW: 0,
        px: '0.16rem',
        py: '0.08rem',
        border: '1px solid transparent',
        borderRadius: 'var(--rose-radius-xs)',
        appearance: 'textfield',
        bg: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 'inherit',
        lineHeight: 1,
        textAlign: 'right',
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
        _hover: {
            borderColor: 'color-mix(in srgb, var(--rose-border) 72%, transparent)'
        },
        _focus: {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 58%, var(--rose-border))',
            bg: 'var(--rose-surface-soft)'
        },
        _disabled: {
            color: 'var(--rose-muted)',
            cursor: 'not-allowed',
            _hover: {
                borderColor: 'transparent'
            }
        },
        '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
            m: 0,
            appearance: 'none'
        }
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
    const [typing, setTyping] = createSignal(false);
    const [typedValue, setTypedValue] = createSignal(String(committedValue()));

    createEffect(() => {
        const nextValue = committedValue();
        setDraftValue(nextValue);
        if (!typing()) {
            setTypedValue(String(nextValue));
        }
    });

    const clampDraft = (value: string | number) => snapStatTarget(Number(value) || 0, props.cap, props.allowBalancedTuning);
    const inputDisabled = () => props.disabled || props.pending || maxValue() <= 0;
    const statEffects = () => armorStatEffectsAt(props.stat, draftValue());

    const previewDraftValue = (value: number) => {
        setDraftValue(value);
        if (!typing()) {
            setTypedValue(String(value));
        }
    };

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
        previewDraftValue(nextValue);
        setTypedValue(String(nextValue));

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
        previewDraftValue(valueFromPointer(event));
    };

    const drag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        event.preventDefault();
        previewDraftValue(valueFromPointer(event));
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
        previewDraftValue(committedValue());
    };

    const beginTyping = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
        if (inputDisabled()) {
            return;
        }

        const input = event.currentTarget;
        setTyping(true);
        setTypedValue(String(draftValue()));
        requestAnimationFrame(() => input.select());
    };

    const updateTypedValue = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
        const nextValue = event.currentTarget.value.replace(/\D/g, '').slice(0, 3);
        setTypedValue(nextValue);
        if (nextValue) {
            setDraftValue(clampDraft(nextValue));
        }
    };

    const commitTypedValue = () => {
        const value = typedValue();
        setTyping(false);
        commit(value || 0);
    };

    const cancelTypedValue = (input: HTMLInputElement) => {
        setTyping(false);
        previewDraftValue(committedValue());
        setTypedValue(String(committedValue()));
        input.blur();
    };

    const handleTypedValueKeyDown = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitTypedValue();
            event.currentTarget.blur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            cancelTypedValue(event.currentTarget);
        }
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
            <StatSliderName>
                {props.label}
                <HelpTooltip label={`What ${props.label} does at ${draftValue()}`}>
                    <StatEffectContent>
                        <StatEffectHeading>{statEffects().heading}</StatEffectHeading>
                        <StatEffectList>
                            <For each={statEffects().effects}>
                                {(effect) => (
                                    <StatEffectRow>
                                        <StatEffectLabel>{effect.label}</StatEffectLabel>
                                        <StatEffectValue>{effect.value}</StatEffectValue>
                                    </StatEffectRow>
                                )}
                            </For>
                        </StatEffectList>
                        <Show when={statEffects().note}>{(note) => <StatEffectNote>{note()}</StatEffectNote>}</Show>
                    </StatEffectContent>
                </HelpTooltip>
            </StatSliderName>
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
                <StatValueInput
                    aria-label={`Set ${props.label} target`}
                    disabled={inputDisabled()}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={typing() ? typedValue() : String(draftValue())}
                    onBlur={commitTypedValue}
                    onFocus={beginTyping}
                    onInput={updateTypedValue}
                    onKeyDown={handleTypedValueKeyDown}
                />
                <StatCap>/ {props.pending ? 'checking' : maxValue()}</StatCap>
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
