import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { css } from '@panda/css';
import { createEffect, createSignal, For, Show } from 'solid-js';

import type { CharacterButtonClass, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { ControlSection } from '@/features/armor/components/control-section';
import { field, input, label, MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';

const MAX_STAT_TARGET = 200;
const STAT_SCALE_VALUES = [0, 25, 50, 75, 100, 125, 150, 175, 200] as const;

type ClassStatSettingsProps = {
    characterOptions: CharacterButtonOption[];
    selectedCharacterId: string;
    dumpStat: ArmorStat | '';
    allowBalancedTuning: boolean;
    targets: StatVector;
    targetCaps: StatVector;
    onCharacterSelect: (characterId: string) => void;
    onDumpStatChange: (stat: string) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onTargetChange: (stat: ArmorStat, value: string) => void;
};

const primarySettingsGrid = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '17rem minmax(0, 1fr)' },
    gap: { base: '1rem', lg: '1.25rem' },
    alignItems: 'stretch',
    minW: 0
});

const settingsColumn = css({
    display: 'grid',
    gap: '0.9rem',
    minW: 0
});

const characterButtonGrid = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.55rem',
    maxW: 'none'
});

const characterButton = css({
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
});

const classIcon = css({
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
});

const statGrid = css({
    display: 'grid',
    gap: '0.55rem'
});

const statSliderRow = css({
    display: 'grid',
    gridTemplateAreas: '"name value" "slider slider"',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.28rem 0.75rem',
    alignItems: 'center',
    py: '0.05rem',
    minW: 0
});

const statScaleRow = css({
    display: { base: 'none', md: 'grid' },
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'center',
    minW: 0
});

const statScale = css({
    position: 'relative',
    h: '1rem',
    mx: '9px',
    minW: 0
});

const statScaleNumber = css({
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
});

const statSliderFrame = css({
    gridArea: 'slider',
    position: 'relative',
    display: 'grid',
    alignItems: 'center',
    h: '36px',
    minW: 0,
    '--stat-tick-color': 'rgba(244, 244, 245, 0.24)',
    '--stat-major-color': 'rgba(244, 244, 245, 0.72)'
});

const statSliderName = css({
    gridArea: 'name',
    minW: 0
});

const statSlider = css({
    position: 'relative',
    zIndex: 1,
    w: '100%',
    minW: 0,
    h: '24px',
    appearance: 'none',
    bg: 'transparent',
    cursor: 'pointer',
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
    '&::-webkit-slider-runnable-track': {
        h: 'var(--stat-track-height)',
        borderRadius: 'var(--stat-track-radius)',
        bg: 'var(--stat-track-bg)',
        border: 'var(--stat-track-border)'
    },
    '&::-webkit-slider-thumb': {
        appearance: 'none',
        w: 'var(--stat-thumb-size)',
        h: 'var(--stat-thumb-size)',
        mt: 'var(--stat-thumb-offset)',
        borderRadius: 'var(--stat-thumb-radius)',
        border: 'var(--stat-thumb-border)',
        bg: 'var(--stat-thumb-bg)',
        boxShadow: 'var(--stat-thumb-shadow)',
        transform: 'var(--stat-thumb-transform)',
        cursor: 'grab'
    },
    '&:active::-webkit-slider-thumb': {
        cursor: 'grabbing'
    },
    '&::-moz-range-track': {
        h: 'var(--stat-track-height)',
        borderRadius: 'var(--stat-track-radius)',
        bg: 'var(--stat-track-bg)',
        border: 'var(--stat-track-border)'
    },
    '&::-moz-range-thumb': {
        w: 'var(--stat-thumb-size)',
        h: 'var(--stat-thumb-size)',
        borderRadius: 'var(--stat-thumb-radius)',
        border: 'var(--stat-thumb-border)',
        bg: 'var(--stat-thumb-bg)',
        boxShadow: 'var(--stat-thumb-shadow)',
        transform: 'var(--stat-thumb-transform)',
        cursor: 'grab'
    },
    '&:active::-moz-range-thumb': {
        cursor: 'grabbing'
    },
    _disabled: {
        opacity: 0.35,
        cursor: 'not-allowed'
    }
});

const statValue = css({
    gridArea: 'value',
    justifySelf: 'end',
    fontFamily: MONO_FONT_FAMILY,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--rose-text)',
    fontSize: '0.86rem',
    fontWeight: 680
});

const statCap = css({
    color: 'var(--rose-muted)',
    fontSize: '0.68rem'
});

const checkboxField = css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.72rem',
    letterSpacing: 0,
    color: 'var(--rose-muted-strong)'
});

const hiddenControl = css({
    display: 'none'
});

function ClassIcon(props: { classType: CharacterButtonClass }) {
    return <span class={classIcon} data-class={props.classType} aria-hidden="true" />;
}

export function CharacterPicker(props: {
    labelText?: string | false;
    options: CharacterButtonOption[];
    selectedCharacterId: string;
    onSelect: (characterId: string) => void;
}) {
    return (
        <div class={field}>
            <Show when={props.labelText !== false}>
                <span class={label}>{props.labelText ?? 'Character'}</span>
            </Show>
            <div class={characterButtonGrid}>
                <For each={props.options}>
                    {({ classType, character }) => (
                        <button
                            class={characterButton}
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
                        </button>
                    )}
                </For>
            </div>
        </div>
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
            <label class={field}>
                <span class={label}>Dump Stat</span>
                <select class={input} value={props.dumpStat} onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}>
                    <option value="">No dump stat</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </select>
            </label>
            <label class={`${checkboxField} ${hiddenControl}`} aria-hidden="true">
                <input
                    type="checkbox"
                    checked={props.allowBalancedTuning}
                    disabled
                    tabIndex={-1}
                    onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                />
                Balanced Tuning
            </label>
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
    cap: number;
    disabled: boolean;
    label: string;
    stat: ArmorStat;
    value: number;
    onCommit: (stat: ArmorStat, value: string) => void;
}) {
    const committedValue = () => Math.min(props.value, props.cap);
    const [draftValue, setDraftValue] = createSignal(committedValue());

    createEffect(() => {
        setDraftValue(committedValue());
    });

    function clampDraft(value: string | number) {
        return Math.max(0, Math.min(props.cap, MAX_STAT_TARGET, Math.trunc(Number(value) || 0)));
    }

    function updateDraft(event: InputEvent & { currentTarget: HTMLInputElement }) {
        const nextValue = clampDraft(event.currentTarget.value);
        event.currentTarget.value = String(nextValue);
        setDraftValue(nextValue);
    }

    function commit(value: string | number = draftValue()) {
        const nextValue = clampDraft(value);
        setDraftValue(nextValue);

        if (nextValue !== props.value) {
            props.onCommit(props.stat, String(nextValue));
        }
    }

    function commitKeyboardChange(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            commit(event.currentTarget.value);
        }
    }

    function percent(value: number) {
        return Math.max(0, Math.min(100, (value / MAX_STAT_TARGET) * 100));
    }

    return (
        <label class={statSliderRow}>
            <span class={`${label} ${statSliderName}`}>{props.label}</span>
            <div class={statSliderFrame}>
                <input
                    class={statSlider}
                    style={`--stat-value-percent: ${percent(draftValue())}%; --stat-cap-percent: ${percent(props.cap)}%;`}
                    min="0"
                    max={MAX_STAT_TARGET}
                    step="1"
                    type="range"
                    value={draftValue()}
                    disabled={props.disabled || props.cap <= 0}
                    onInput={updateDraft}
                    onChange={(event) => commit(event.currentTarget.value)}
                    onPointerUp={(event) => commit(event.currentTarget.value)}
                    onBlur={(event) => commit(event.currentTarget.value)}
                    onKeyUp={commitKeyboardChange}
                />
            </div>
            <span class={statValue}>
                {draftValue()} <span class={statCap}>/ {props.cap}</span>
            </span>
        </label>
    );
}

export function StatTargetFields(props: Pick<ClassStatSettingsProps, 'dumpStat' | 'onTargetChange' | 'targetCaps' | 'targets'>) {
    function percent(value: number) {
        return Math.max(0, Math.min(100, (value / MAX_STAT_TARGET) * 100));
    }

    return (
        <div class={statGrid}>
            <div class={statScaleRow} aria-hidden="true">
                <div class={statScale}>
                    <For each={STAT_SCALE_VALUES}>
                        {(value) => (
                            <span class={statScaleNumber} data-major={value === 100} style={`--stat-scale-left: ${percent(value)}%;`}>
                                {value}
                            </span>
                        )}
                    </For>
                </div>
            </div>
            <For each={ARMOR_STATS}>
                {(stat) => {
                    const cap = () => (props.dumpStat === stat ? 0 : props.targetCaps[stat]);
                    const value = () => Math.min(props.targets[stat], cap());

                    return (
                        <StatTargetSlider
                            cap={cap()}
                            disabled={props.dumpStat === stat}
                            label={STAT_LABELS[stat]}
                            stat={stat}
                            value={value()}
                            onCommit={props.onTargetChange}
                        />
                    );
                }}
            </For>
        </div>
    );
}

export function StatTargetControls(props: Pick<ClassStatSettingsProps, 'dumpStat' | 'onTargetChange' | 'targetCaps' | 'targets'>) {
    return (
        <ControlSection title="Stat targets">
            <StatTargetFields
                dumpStat={props.dumpStat}
                onTargetChange={props.onTargetChange}
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
        <div class={settingsColumn}>
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
        </div>
    );
}

export function ClassStatSettings(props: ClassStatSettingsProps) {
    return (
        <div class={primarySettingsGrid}>
            <SideControls
                allowBalancedTuning={props.allowBalancedTuning}
                characterOptions={props.characterOptions}
                dumpStat={props.dumpStat}
                onBalancedTuningChange={props.onBalancedTuningChange}
                onCharacterSelect={props.onCharacterSelect}
                onDumpStatChange={props.onDumpStatChange}
                selectedCharacterId={props.selectedCharacterId}
            />

            <div class={settingsColumn}>
                <StatTargetControls
                    dumpStat={props.dumpStat}
                    onTargetChange={props.onTargetChange}
                    targetCaps={props.targetCaps}
                    targets={props.targets}
                />
            </div>
        </div>
    );
}
