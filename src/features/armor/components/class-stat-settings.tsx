import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { styled } from '@panda/jsx';
import { createEffect, createSignal, For, Show } from 'solid-js';

import type { CharacterButtonClass, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { ControlSection } from '@/features/armor/components/control-section';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import { snapStatTarget, statTargetMax, statTargetStep } from '@/features/armor/target-cap-state';

const MAX_STAT_TARGET = 200;
const STAT_SCALE_VALUES = [0, 25, 50, 75, 100, 125, 150, 175, 200] as const;

type ClassStatSettingsProps = {
    characterOptions: CharacterButtonOption[];
    selectedCharacterId: string;
    dumpStat: ArmorStat | '';
    allowBalancedTuning: boolean;
    targets: StatVector;
    targetCaps: StatVector;
    targetCapsPending: boolean;
    onCharacterSelect: (characterId: string) => void;
    onDumpStatChange: (stat: string) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onTargetChange: (stat: ArmorStat, value: string) => void;
};

const PrimarySettingsGrid = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '17rem minmax(0, 1fr)' },
        gap: { base: '1rem', lg: '1.25rem' },
        alignItems: 'stretch',
        minW: 0
    }
});

const SettingsColumn = styled('div', {
    base: {
        display: 'grid',
        gap: '0.9rem',
        minW: 0
    }
});

const Field = styled('label', {
    base: {
        display: 'grid',
        gap: '0.42rem',
        minW: 0
    }
});

const FieldGroup = styled('div', {
    base: {
        display: 'grid',
        gap: '0.42rem',
        minW: 0
    }
});

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

const SelectInput = styled('select', {
    base: {
        w: '100%',
        minW: 0,
        boxSizing: 'border-box',
        minH: '38px',
        border: '1px solid var(--rose-border)',
        borderRadius: '0.5rem',
        bg: 'var(--rose-surface-soft)',
        px: '0.72rem',
        color: 'var(--rose-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.86rem',
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
    }
});

const CharacterButtonGrid = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.55rem',
        maxW: 'none'
    }
});

const CharacterButton = styled('button', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minH: '44px',
        border: '1px solid var(--rose-border)',
        borderRadius: '0.65rem',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease',
        _hover: {
            color: 'var(--rose-muted-strong)',
            borderColor: 'var(--rose-border-strong)',
            bg: 'var(--rose-surface-raised)'
        },
        _disabled: {
            opacity: 0.22,
            cursor: 'not-allowed'
        },
        '&[data-selected="true"]': {
            color: 'var(--rose-accent)',
            borderColor: 'var(--rose-accent)',
            bg: 'color-mix(in srgb, var(--rose-accent) 14%, var(--rose-surface-raised))'
        }
    }
});

const ClassIconGlyph = styled('span', {
    base: {
        w: '22px',
        h: '22px',
        display: 'block',
        bg: 'currentColor',
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        '&[data-class="hunter"]': {
            maskImage: 'url("/assets/classes/hunter.svg")',
            WebkitMaskImage: 'url("/assets/classes/hunter.svg")'
        },
        '&[data-class="warlock"]': {
            maskImage: 'url("/assets/classes/warlock.svg")',
            WebkitMaskImage: 'url("/assets/classes/warlock.svg")'
        },
        '&[data-class="titan"]': {
            maskImage: 'url("/assets/classes/titan.svg")',
            WebkitMaskImage: 'url("/assets/classes/titan.svg")'
        }
    }
});

const StatGrid = styled('div', {
    base: {
        display: 'grid',
        gap: '0.55rem'
    }
});

const StatSliderRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateAreas: '"name value" "slider slider"',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '0.28rem 0.75rem',
        alignItems: 'center',
        py: '0.05rem',
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
        mx: '9px',
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
        h: '36px',
        minW: 0,
        '--stat-tick-color': 'rgba(244, 244, 245, 0.24)',
        '--stat-major-color': 'rgba(244, 244, 245, 0.72)'
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
        '--stat-thumb-offset': '-5px',
        '--stat-thumb-radius': '999px',
        '--stat-thumb-border': '0',
        '--stat-thumb-bg': 'var(--rose-accent)',
        '--stat-thumb-shadow': 'none',
        '--stat-thumb-transform': 'none',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '3px',
            borderRadius: '999px'
        },
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
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
        left: 'var(--stat-value-percent)',
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

const HiddenCheckboxField = styled('label', {
    base: {
        display: 'none',
        alignItems: 'center',
        gap: '8px',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.72rem',
        letterSpacing: 0,
        color: 'var(--rose-muted-strong)'
    }
});

function ClassIcon(props: { classType: CharacterButtonClass }) {
    return <ClassIconGlyph data-class={props.classType} aria-hidden="true" />;
}

export function CharacterPicker(props: {
    labelText?: string | false;
    options: CharacterButtonOption[];
    selectedCharacterId: string;
    onSelect: (characterId: string) => void;
}) {
    return (
        <FieldGroup>
            <Show when={props.labelText !== false}>
                <FieldLabel>{props.labelText ?? 'Character'}</FieldLabel>
            </Show>
            <CharacterButtonGrid>
                <For each={props.options}>
                    {({ classType, character }) => (
                        <CharacterButton
                            type="button"
                            title={character?.label ?? classType}
                            aria-label={`Select ${classType}`}
                            data-selected={character?.characterId === props.selectedCharacterId}
                            disabled={!character}
                            onClick={() => {
                                if (character) {
                                    props.onSelect(character.characterId);
                                }
                            }}
                        >
                            <ClassIcon classType={classType} />
                        </CharacterButton>
                    )}
                </For>
            </CharacterButtonGrid>
        </FieldGroup>
    );
}

export function CharacterControls(props: Pick<ClassStatSettingsProps, 'characterOptions' | 'onCharacterSelect' | 'selectedCharacterId'>) {
    return (
        <ControlSection title="Class">
            <CharacterPicker
                options={props.characterOptions}
                selectedCharacterId={props.selectedCharacterId}
                onSelect={props.onCharacterSelect}
            />
        </ControlSection>
    );
}

export function TuningFields(
    props: Pick<ClassStatSettingsProps, 'allowBalancedTuning' | 'dumpStat' | 'onBalancedTuningChange' | 'onDumpStatChange'>
) {
    return (
        <>
            <Field>
                <FieldLabel>Dump Stat</FieldLabel>
                <SelectInput value={props.dumpStat} onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}>
                    <option value="">None</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </SelectInput>
            </Field>
            <HiddenCheckboxField aria-hidden="true">
                <input
                    type="checkbox"
                    checked={props.allowBalancedTuning}
                    disabled
                    tabIndex={-1}
                    onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                />
                Balanced Tuning
            </HiddenCheckboxField>
        </>
    );
}

export function TuningControls(
    props: Pick<ClassStatSettingsProps, 'allowBalancedTuning' | 'dumpStat' | 'onBalancedTuningChange' | 'onDumpStatChange'>
) {
    return (
        <ControlSection title="Tuning">
            <TuningFields
                allowBalancedTuning={props.allowBalancedTuning}
                dumpStat={props.dumpStat}
                onBalancedTuningChange={props.onBalancedTuningChange}
                onDumpStatChange={props.onDumpStatChange}
            />
        </ControlSection>
    );
}

function StatTargetSlider(props: {
    allowBalancedTuning: boolean;
    cap: number;
    disabled: boolean;
    label: string;
    pending: boolean;
    stat: ArmorStat;
    value: number;
    onCommit: (stat: ArmorStat, value: string) => void;
}) {
    const maxValue = () => statTargetMax(props.cap, props.allowBalancedTuning);
    const committedValue = () => snapStatTarget(props.value, props.cap, props.allowBalancedTuning);
    const [draftValue, setDraftValue] = createSignal(committedValue());
    const [draggingPointerId, setDraggingPointerId] = createSignal<number | null>(null);

    createEffect(() => {
        setDraftValue(committedValue());
    });

    function clampDraft(value: string | number) {
        return snapStatTarget(Number(value) || 0, props.cap, props.allowBalancedTuning);
    }

    function valueFromPointer(event: PointerEvent & { currentTarget: HTMLElement }) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const width = Math.max(1, bounds.width);
        const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / width));
        return clampDraft(Math.round(ratio * MAX_STAT_TARGET));
    }

    function commit(value: string | number = draftValue()) {
        const nextValue = clampDraft(value);
        setDraftValue(nextValue);

        if (nextValue !== props.value) {
            props.onCommit(props.stat, String(nextValue));
        }
    }

    function startDrag(event: PointerEvent & { currentTarget: HTMLElement }) {
        if (props.disabled || props.pending || maxValue() <= 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingPointerId(event.pointerId);
        setDraftValue(valueFromPointer(event));
    }

    function drag(event: PointerEvent & { currentTarget: HTMLElement }) {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        event.preventDefault();
        setDraftValue(valueFromPointer(event));
    }

    function finishDrag(event: PointerEvent & { currentTarget: HTMLElement }) {
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
    }

    function cancelDrag(event: PointerEvent & { currentTarget: HTMLElement }) {
        if (draggingPointerId() !== event.pointerId) {
            return;
        }

        setDraggingPointerId(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDraftValue(committedValue());
    }

    function commitKeyboardChange(event: KeyboardEvent) {
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
    }

    function percent(value: number) {
        return Math.max(0, Math.min(100, (value / MAX_STAT_TARGET) * 100));
    }

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

export function StatTargetFields(
    props: Pick<
        ClassStatSettingsProps,
        'allowBalancedTuning' | 'dumpStat' | 'onTargetChange' | 'targetCaps' | 'targetCapsPending' | 'targets'
    >
) {
    function percent(value: number) {
        return Math.max(0, Math.min(100, (value / MAX_STAT_TARGET) * 100));
    }

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

export function StatTargetControls(
    props: Pick<
        ClassStatSettingsProps,
        'allowBalancedTuning' | 'dumpStat' | 'onTargetChange' | 'targetCaps' | 'targetCapsPending' | 'targets'
    >
) {
    return (
        <ControlSection title="Stat targets">
            <StatTargetFields
                dumpStat={props.dumpStat}
                allowBalancedTuning={props.allowBalancedTuning}
                onTargetChange={props.onTargetChange}
                targetCapsPending={props.targetCapsPending}
                targetCaps={props.targetCaps}
                targets={props.targets}
            />
        </ControlSection>
    );
}

function SideControls(
    props: Pick<
        ClassStatSettingsProps,
        | 'allowBalancedTuning'
        | 'characterOptions'
        | 'dumpStat'
        | 'onBalancedTuningChange'
        | 'onCharacterSelect'
        | 'onDumpStatChange'
        | 'selectedCharacterId'
    >
) {
    return (
        <SettingsColumn>
            <CharacterControls
                characterOptions={props.characterOptions}
                onCharacterSelect={props.onCharacterSelect}
                selectedCharacterId={props.selectedCharacterId}
            />
            <TuningControls
                allowBalancedTuning={props.allowBalancedTuning}
                dumpStat={props.dumpStat}
                onBalancedTuningChange={props.onBalancedTuningChange}
                onDumpStatChange={props.onDumpStatChange}
            />
        </SettingsColumn>
    );
}

export function ClassStatSettings(props: ClassStatSettingsProps) {
    return (
        <PrimarySettingsGrid>
            <SideControls
                allowBalancedTuning={props.allowBalancedTuning}
                characterOptions={props.characterOptions}
                dumpStat={props.dumpStat}
                onBalancedTuningChange={props.onBalancedTuningChange}
                onCharacterSelect={props.onCharacterSelect}
                onDumpStatChange={props.onDumpStatChange}
                selectedCharacterId={props.selectedCharacterId}
            />

            <SettingsColumn>
                <StatTargetControls
                    allowBalancedTuning={props.allowBalancedTuning}
                    dumpStat={props.dumpStat}
                    onTargetChange={props.onTargetChange}
                    targetCapsPending={props.targetCapsPending}
                    targetCaps={props.targetCaps}
                    targets={props.targets}
                />
            </SettingsColumn>
        </PrimarySettingsGrid>
    );
}
