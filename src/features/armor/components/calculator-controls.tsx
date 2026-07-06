import { ARMOR_STATS, type ArmorStat, type StatVector } from '@armor-calc';
import { css } from '@panda/css';
import { For } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { CharacterPicker, StatTargetFields } from '@/features/armor/components/class-stat-settings';
import { ArmorSetFields, ExoticPicker } from '@/features/armor/components/gear-settings';
import { button, input, MONO_FONT_FAMILY, secondaryButton } from '@/features/armor/components/ui-styles';
import { STAT_LABELS } from '@/features/armor/display-metadata';
import type { ArmorSetDisplayMode } from '@/features/armor/result-display';
import { formatFragmentBonus, fragmentsForSubclass, SUBCLASS_TYPES, type SubclassType } from '@/features/armor/subclass-fragments';

type CalculatorControlsProps = {
    characterOptions: CharacterButtonOption[];
    selectedCharacterId: string;
    selectedExoticItemHash: string;
    armorSetDisplayMode: ArmorSetDisplayMode;
    selectedSubclass: SubclassType;
    selectedFragmentIds: string[];
    dumpStat: ArmorStat | '';
    allowBalancedTuning: boolean;
    onlyFullyMasterworkedGear: boolean;
    targets: StatVector;
    targetCaps: StatVector;
    targetCapsPending: boolean;
    setSelections: Record<string, SetSelectionValue>;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    canSolve: boolean;
    solving: boolean;
    onCharacterSelect: (characterId: string) => void;
    onExoticChange: (itemHash: string) => void;
    onArmorSetDisplayModeChange: (mode: ArmorSetDisplayMode) => void;
    onSubclassChange: (subclass: SubclassType) => void;
    onFragmentToggle: (fragmentId: string) => void;
    onImportFragmentsFromGame: () => void;
    onDumpStatChange: (stat: string) => void;
    onBalancedTuningChange: (enabled: boolean) => void;
    onOnlyFullyMasterworkedGearChange: (enabled: boolean) => void;
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

const advancedSection = css({
    pt: '0.8rem',
    borderTop: '1px solid var(--rose-border)',
    '& summary': {
        cursor: 'pointer',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        fontWeight: 720,
        lineHeight: 1,
        listStyle: 'revert'
    },
    '&[open] summary': {
        color: 'var(--rose-text)'
    }
});

const advancedBody = css({
    display: 'grid',
    gap: '0.42rem',
    pt: '0.72rem'
});

const fragmentHeader = css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.65rem',
    alignItems: 'center'
});

const fragmentHeaderActions = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    flexWrap: 'wrap'
});

const fragmentSubclassSelect = css({
    h: '34px',
    minH: '34px',
    fontSize: '0.78rem'
});

const fragmentCount = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.72rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap'
});

const fragmentImportButton = css({
    minH: '28px',
    px: '0.68rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.55rem',
    bg: 'var(--rose-surface-soft)',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.7rem',
    fontWeight: 720,
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease',
    _hover: {
        bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))',
        borderColor: 'color-mix(in srgb, var(--rose-accent) 44%, var(--rose-border))'
    },
    _focusVisible: {
        outline: '2px solid color-mix(in srgb, var(--rose-accent) 42%, transparent)',
        outlineOffset: '2px'
    }
});

const fragmentWipTag = css({
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.62rem',
    fontWeight: 680,
    letterSpacing: '0.02em',
    ml: '0.4rem',
    verticalAlign: 'middle'
});

const fragmentTableFrame = css({
    overflow: 'hidden',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.55rem',
    bg: 'var(--rose-surface)'
});

const fragmentTableScroll = css({
    maxH: '13.5rem',
    overflowY: 'auto'
});

const fragmentTable = css({
    w: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    '& th': {
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 74%, #000 26%)',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem',
        fontWeight: 760,
        lineHeight: 1,
        textAlign: 'left',
        py: '0.48rem',
        borderBottom: '1px solid var(--rose-border)'
    },
    '& td': {
        py: '0.42rem',
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 72%, transparent)',
        color: 'var(--rose-text)',
        fontSize: '0.78rem',
        lineHeight: 1.15,
        verticalAlign: 'middle'
    },
    '& tr:last-child td': {
        borderBottom: 0
    },
    '& tr[data-selected="true"] td': {
        bg: 'color-mix(in srgb, var(--rose-accent) 10%, transparent)'
    }
});

const fragmentCheckCell = css({
    w: '2.1rem',
    textAlign: 'center',
    '& input': {
        accentColor: 'var(--rose-accent)'
    }
});

const fragmentNameCell = css({
    px: '0.35rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 660
});

const fragmentBonusCell = css({
    pr: '0.55rem',
    color: 'var(--rose-muted-strong)!',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.72rem!important',
    textAlign: 'right',
    whiteSpace: 'nowrap'
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

function DumpControls(props: Pick<CalculatorControlsProps, 'dumpStat' | 'onDumpStatChange'>) {
    return (
        <div class={inlineControls}>
            <div class={selectWrap}>
                <select
                    class={`${input} ${dumpSelect}`}
                    value={props.dumpStat}
                    onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}
                >
                    <option value="">None</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </select>
            </div>
        </div>
    );
}

function FragmentControls(
    props: Pick<
        CalculatorControlsProps,
        'onFragmentToggle' | 'onImportFragmentsFromGame' | 'onSubclassChange' | 'selectedFragmentIds' | 'selectedSubclass'
    >
) {
    const selectedIds = () => new Set(props.selectedFragmentIds);
    const fragments = () => fragmentsForSubclass(props.selectedSubclass);

    return (
        <section class={section} aria-label="Fragments">
            <div class={fragmentHeader}>
                <h2 class={sectionTitle}>
                    Fragments <span class={fragmentWipTag}>(WIP UI)</span>
                </h2>
                <div class={fragmentHeaderActions}>
                    <button class={fragmentImportButton} type="button" onClick={props.onImportFragmentsFromGame}>
                        Import from game
                    </button>
                    <span class={fragmentCount}>{props.selectedFragmentIds.length} selected</span>
                </div>
            </div>
            <select
                class={`${input} ${fragmentSubclassSelect}`}
                value={props.selectedSubclass}
                onChange={(event) => props.onSubclassChange(event.currentTarget.value as SubclassType)}
            >
                <For each={SUBCLASS_TYPES}>{(subclass) => <option value={subclass}>{subclass}</option>}</For>
            </select>
            <div class={fragmentTableFrame}>
                <div class={fragmentTableScroll}>
                    <table class={fragmentTable}>
                        <colgroup>
                            <col style={{ width: '2.1rem' }} />
                            <col />
                            <col style={{ width: '7.2rem' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th class={fragmentCheckCell} />
                                <th class={fragmentNameCell}>Fragment</th>
                                <th class={fragmentBonusCell}>Stats</th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={fragments()}>
                                {(fragment) => {
                                    const selected = () => selectedIds().has(fragment.id);

                                    return (
                                        <tr data-selected={selected()}>
                                            <td class={fragmentCheckCell}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected()}
                                                    aria-label={`Toggle ${fragment.name}`}
                                                    onChange={() => props.onFragmentToggle(fragment.id)}
                                                />
                                            </td>
                                            <td class={fragmentNameCell} title={fragment.name}>
                                                {fragment.name}
                                            </td>
                                            <td class={fragmentBonusCell}>{formatFragmentBonus(fragment)}</td>
                                        </tr>
                                    );
                                }}
                            </For>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function AdvancedControls(
    props: Pick<
        CalculatorControlsProps,
        | 'allowBalancedTuning'
        | 'armorSetDisplayMode'
        | 'onArmorSetDisplayModeChange'
        | 'onBalancedTuningChange'
        | 'onOnlyFullyMasterworkedGearChange'
        | 'onlyFullyMasterworkedGear'
    >
) {
    return (
        <details class={advancedSection}>
            <summary>Advanced</summary>
            <div class={advancedBody}>
                <label class={formRow}>
                    <span class={rowLabel}>Armor set labels</span>
                    <select
                        class={input}
                        value={props.armorSetDisplayMode}
                        onChange={(event) => props.onArmorSetDisplayModeChange(event.currentTarget.value as ArmorSetDisplayMode)}
                    >
                        <option value="sets">Set names</option>
                        <option value="sources">Sources</option>
                    </select>
                </label>
                <label class={checkboxField}>
                    <input
                        type="checkbox"
                        checked={props.allowBalancedTuning}
                        onChange={(event) => props.onBalancedTuningChange(event.currentTarget.checked)}
                    />
                    Balanced tuning
                </label>
                <label class={checkboxField}>
                    <input
                        type="checkbox"
                        checked={props.onlyFullyMasterworkedGear}
                        onChange={(event) => props.onOnlyFullyMasterworkedGearChange(event.currentTarget.checked)}
                    />
                    Only fully masterworked gear
                </label>
            </div>
        </details>
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
                        <DumpControls dumpStat={props.dumpStat} onDumpStatChange={props.onDumpStatChange} />
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
                        allowBalancedTuning={props.allowBalancedTuning}
                        dumpStat={props.dumpStat}
                        onTargetChange={props.onTargetChange}
                        targetCapsPending={props.targetCapsPending}
                        targetCaps={props.targetCaps}
                        targets={props.targets}
                    />
                </section>

                <FragmentControls
                    selectedSubclass={props.selectedSubclass}
                    selectedFragmentIds={props.selectedFragmentIds}
                    onSubclassChange={props.onSubclassChange}
                    onFragmentToggle={props.onFragmentToggle}
                    onImportFragmentsFromGame={props.onImportFragmentsFromGame}
                />

                <section class={section} aria-label="Sets">
                    <h2 class={sectionTitle}>Sets</h2>
                    <ArmorSetFields
                        armorSetDisplayMode={props.armorSetDisplayMode}
                        onSetRequirementChange={props.onSetRequirementChange}
                        selectableSets={props.selectableSets}
                        setSelections={props.setSelections}
                    />
                </section>

                <AdvancedControls
                    allowBalancedTuning={props.allowBalancedTuning}
                    armorSetDisplayMode={props.armorSetDisplayMode}
                    onlyFullyMasterworkedGear={props.onlyFullyMasterworkedGear}
                    onArmorSetDisplayModeChange={props.onArmorSetDisplayModeChange}
                    onBalancedTuningChange={props.onBalancedTuningChange}
                    onOnlyFullyMasterworkedGearChange={props.onOnlyFullyMasterworkedGearChange}
                />

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
