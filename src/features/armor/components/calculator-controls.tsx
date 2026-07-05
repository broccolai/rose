import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { css } from '@panda/css';
import { For } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { CharacterPicker, StatTargetFields } from '@/features/armor/components/class-stat-settings';
import { ArmorSetFields, ExoticPicker } from '@/features/armor/components/gear-settings';
import { button, input, MONO_FONT_FAMILY, secondaryButton } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';

type CalculatorControlsProps = {
    characterOptions: CharacterButtonOption[];
    selectedCharacterId: string;
    selectedExoticItemHash: string;
    dumpStat: ArmorStat | '';
    allowBalancedTuning: boolean;
    targets: StatVector;
    targetCaps: StatVector;
    setSelections: Record<string, SetSelectionValue>;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    canSolve: boolean;
    solving: boolean;
    onCharacterSelect: (characterId: string) => void;
    onExoticChange: (itemHash: string) => void;
    onDumpStatChange: (stat: string) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onTargetChange: (stat: ArmorStat, value: string) => void;
    onSetRequirementChange: (setId: string, value: string) => void;
    onSolve: () => void;
    onClearChoices: () => void;
};

const controlGrid = css({
    display: 'grid',
    gap: '1rem',
    maxW: 'none',
    mx: 'auto',
    w: '100%'
});

const settingsPanel = css({
    display: 'grid',
    gap: { base: '1rem', md: '1.08rem' },
    minW: 0,
    p: 0,
    border: 0,
    borderRadius: 0,
    bg: 'transparent',
    boxShadow: 'none'
});

const formRows = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
    gap: '0.72rem',
    alignItems: 'start',
    '& > :last-child': {
        gridColumn: { md: '1 / -1' }
    }
});

const formRow = css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '0.45rem',
    alignItems: 'start',
    minW: 0
});

const rowLabel = css({
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.82rem',
    lineHeight: 1,
    fontWeight: 680,
    color: 'var(--rose-muted)'
});

const inlineControls = css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.55rem',
    minW: 0
});

const selectWrap = css({
    w: { base: '100%', md: 'min(24rem, 100%)' },
    minW: 0
});

const dumpSelect = css({
    h: '44px',
    minH: '44px'
});

const checkboxField = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.42rem',
    minH: '32px',
    color: 'var(--rose-muted-strong)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.72rem',
    fontWeight: 600
});

const hiddenControl = css({
    display: 'none'
});

const section = css({
    display: 'grid',
    gap: '0.8rem',
    minW: 0,
    pt: '1rem',
    borderTop: '1px solid var(--rose-border)'
});

const sectionTitle = css({
    m: 0,
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.95rem',
    lineHeight: 1,
    fontWeight: 760,
    color: 'var(--rose-text)'
});

const panelTitle = css({
    m: 0,
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '1.05rem',
    lineHeight: 1,
    fontWeight: 780,
    color: 'var(--rose-text)'
});

const actionStack = css({
    display: 'grid',
    gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
    gap: '0.55rem',
    pt: '0.2rem',
    '& button': {
        minW: 0,
        whiteSpace: 'nowrap'
    }
});

function ActionControls(props: Pick<CalculatorControlsProps, 'canSolve' | 'onClearChoices' | 'onSolve' | 'solving'>) {
    return (
        <div class={actionStack}>
            <button class={button} type="button" onClick={props.onSolve} disabled={!props.canSolve || props.solving}>
                Solve Builds
            </button>
            <button class={secondaryButton} type="button" onClick={props.onClearChoices}>
                Clear Choices
            </button>
        </div>
    );
}

function DumpControls(
    props: Pick<CalculatorControlsProps, 'allowBalancedTuning' | 'dumpStat' | 'onBalancedTuningChange' | 'onDumpStatChange'>
) {
    return (
        <div class={inlineControls}>
            <div class={selectWrap}>
                <select
                    class={`${input} ${dumpSelect}`}
                    value={props.dumpStat}
                    onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}
                >
                    <option value="">No dump stat</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </select>
            </div>
            <label class={`${checkboxField} ${hiddenControl}`} aria-hidden="true">
                <input
                    type="checkbox"
                    checked={props.allowBalancedTuning}
                    disabled
                    tabIndex={-1}
                    onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                />
                Balanced tuning
            </label>
        </div>
    );
}

export function CalculatorControls(props: CalculatorControlsProps) {
    return (
        <div class={controlGrid}>
            <div class={settingsPanel}>
                <h2 class={panelTitle}>Build Inputs</h2>
                <div class={formRows}>
                    <div class={formRow}>
                        <span class={rowLabel}>Class</span>
                        <CharacterPicker
                            labelText={false}
                            options={props.characterOptions}
                            selectedCharacterId={props.selectedCharacterId}
                            onSelect={props.onCharacterSelect}
                        />
                    </div>

                    <div class={formRow}>
                        <span class={rowLabel}>Dump</span>
                        <DumpControls
                            allowBalancedTuning={props.allowBalancedTuning}
                            dumpStat={props.dumpStat}
                            onBalancedTuningChange={props.onBalancedTuningChange}
                            onDumpStatChange={props.onDumpStatChange}
                        />
                    </div>

                    <div class={formRow}>
                        <span class={rowLabel}>Exotic</span>
                        <ExoticPicker
                            labelText={false}
                            availableExotics={props.availableExotics}
                            onExoticChange={props.onExoticChange}
                            selectedExoticItemHash={props.selectedExoticItemHash}
                        />
                    </div>
                </div>

                <section class={section} aria-label="Targets">
                    <h2 class={sectionTitle}>Targets</h2>
                    <StatTargetFields
                        dumpStat={props.dumpStat}
                        onTargetChange={props.onTargetChange}
                        targetCaps={props.targetCaps}
                        targets={props.targets}
                    />
                </section>

                <section class={section} aria-label="Sets">
                    <h2 class={sectionTitle}>Sets</h2>
                    <ArmorSetFields
                        onSetRequirementChange={props.onSetRequirementChange}
                        selectableSets={props.selectableSets}
                        setSelections={props.setSelections}
                    />
                </section>

                <ActionControls
                    canSolve={props.canSolve}
                    onClearChoices={props.onClearChoices}
                    onSolve={props.onSolve}
                    solving={props.solving}
                />
            </div>
        </div>
    );
}
