import { css } from '@panda/css';
import { For, Show } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic } from '@/features/armor/calculator-view-model';
import { ControlSection } from '@/features/armor/components/control-section';
import { field, input, label, MONO_FONT_FAMILY, muted } from '@/features/armor/components/ui-styles';

type GearSettingsProps = {
    selectedExoticItemHash: string;
    setSelections: Record<string, SetSelectionValue>;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    onExoticChange: (itemHash: string) => void;
    onSetRequirementChange: (setId: string, value: string) => void;
};

const gearGrid = css({
    display: 'grid',
    gap: '0.75rem',
    alignItems: 'start',
    minW: 0,
    '--rose-op': '#d8b15f'
});

const exoticSelect = css({
    colorScheme: 'dark',
    minH: '38px',
    fontSize: '0.86rem',
    cursor: 'pointer'
});

const labelLine = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem'
});

const exoticBadge = css({
    display: 'inline-flex',
    alignItems: 'center',
    minH: '18px',
    px: '0.4rem',
    border: '1px solid color-mix(in srgb, var(--rose-exotic) 62%, var(--rose-border))',
    borderRadius: '999px',
    color: 'var(--rose-exotic)',
    bg: 'color-mix(in srgb, var(--rose-exotic) 10%, var(--rose-surface))',
    fontSize: '0.66rem',
    fontWeight: 760
});

const setList = css({
    display: 'grid',
    gap: '0.72rem',
    minW: 0,
    maxH: '18rem',
    overflowY: 'auto',
    pr: '0.25rem',
    '--rose-op': '#d8b15f'
});

const setSection = css({
    display: 'grid',
    gap: '0.45rem',
    minW: 0
});

const setSectionTitle = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: 'var(--rose-muted)',
    fontSize: '0.68rem',
    fontWeight: 760,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    _after: {
        content: '""',
        h: '1px',
        flex: 1,
        bg: 'var(--rose-border)'
    },
    '&[data-op="true"]': {
        color: 'var(--rose-op)'
    }
});

const setGrid = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11.75rem), 1fr))',
    gap: '0.55rem',
    minW: 0
});

const setRow = css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto auto',
    alignItems: 'start',
    alignContent: 'space-between',
    gap: '0.42rem',
    minW: 0,
    minH: '64px',
    p: '0.42rem',
    border: '1px solid transparent',
    borderRadius: '0.5rem',
    bg: 'color-mix(in srgb, var(--rose-surface-soft) 86%, #000 14%)',
    '&[data-unavailable="true"]': {
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 54%, #000 46%)',
        '& > span': {
            color: 'color-mix(in srgb, var(--rose-muted) 74%, #000 26%)'
        }
    }
});

const setName = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.38rem',
    minW: 0,
    pr: '1.7rem',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    color: 'var(--rose-text)',
    fontWeight: 680,
    fontSize: '0.82rem',
    lineHeight: 1.15
});

const setNameText = css({
    minW: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
});

const setCount = css({
    position: 'absolute',
    top: '0.46rem',
    right: '0.5rem',
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.76rem',
    fontWeight: 750,
    lineHeight: 1
});

const segmentedControl = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    m: 0,
    p: 0,
    h: '26px',
    minInlineSize: 0,
    border: '1px solid var(--rose-border)',
    borderRadius: '0.35rem',
    overflow: 'hidden',
    bg: 'var(--rose-surface)'
});

const segmentButton = css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minH: 0,
    h: '100%',
    px: 0,
    py: 0,
    border: 0,
    borderInlineEnd: '1px solid var(--rose-border)',
    appearance: 'none',
    overflow: 'hidden',
    bg: 'transparent',
    color: 'var(--rose-muted)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0,
    _last: {
        borderInlineEnd: 0
    },
    '&[data-disabled="false"]:hover': {
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-text)'
    },
    '&[data-op="true"]': {
        color: 'color-mix(in srgb, var(--rose-op) 56%, var(--rose-muted) 44%)',
        bg: 'color-mix(in srgb, var(--rose-op) 10%, transparent)'
    },
    '&[data-disabled="true"]': {
        opacity: 0.34,
        cursor: 'not-allowed'
    },
    '&[data-disabled="true"][data-op="true"]': {
        opacity: 0.46,
        color: 'color-mix(in srgb, var(--rose-op) 46%, var(--rose-muted) 54%)',
        bg: 'color-mix(in srgb, var(--rose-op) 7%, transparent)'
    },
    '&[data-disabled="false"]': {
        cursor: 'pointer'
    },
    '&[data-selected="true"]': {
        bg: 'var(--rose-button)',
        color: 'var(--rose-button-text)',
        boxShadow: 'inset 0 0 0 1px var(--rose-accent)'
    },
    '&[data-selected="true"][data-op="true"]': {
        bg: 'color-mix(in srgb, var(--rose-op) 18%, var(--rose-button))',
        color: 'var(--rose-button-text)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--rose-op) 32%, var(--rose-accent))'
    }
});

const opSegmentButton = css({
    bg: 'color-mix(in srgb, #d8b15f 10%, transparent)!'
});

export function ExoticPicker(
    props: Pick<GearSettingsProps, 'availableExotics' | 'onExoticChange' | 'selectedExoticItemHash'> & { labelText?: string | false }
) {
    return (
        <label class={field}>
            <Show when={props.labelText !== false}>
                <span class={`${label} ${labelLine}`}>
                    {props.labelText ?? 'Choose one'}
                    <Show when={props.selectedExoticItemHash}>
                        <span class={exoticBadge}>Exotic</span>
                    </Show>
                </span>
            </Show>
            <select
                class={`${input} ${exoticSelect}`}
                value={props.selectedExoticItemHash}
                onChange={(event) => props.onExoticChange(event.currentTarget.value)}
            >
                <option value="">None</option>
                <For each={props.availableExotics}>{(exotic) => <option value={String(exotic.itemHash)}>{exotic.name}</option>}</For>
            </select>
        </label>
    );
}

export function ExoticControls(props: Pick<GearSettingsProps, 'availableExotics' | 'onExoticChange' | 'selectedExoticItemHash'>) {
    return (
        <ControlSection title="Exotic armor">
            <ExoticPicker
                availableExotics={props.availableExotics}
                onExoticChange={props.onExoticChange}
                selectedExoticItemHash={props.selectedExoticItemHash}
            />
        </ControlSection>
    );
}

function setBonusTooltip(set: AvailableArmorSet, requiredPieces: 2 | 4) {
    const opBonus = set.opBonuses.find((bonus) => bonus.requiredPieces === requiredPieces);
    const bonus = set.bonuses.find((setBonus) => setBonus.requiredPieces === requiredPieces);
    const ownership = `Own ${Math.min(set.count, requiredPieces)} / ${requiredPieces} compatible pieces.`;

    if (opBonus) {
        const manifestDetails = bonus ? [`Manifest: ${bonus.name}`, bonus.description].filter(Boolean).join('\n') : '';
        return [
            `OP ${opBonus.source} ${requiredPieces}pc (${opBonus.category}${opBonus.bugged ? ', bugged' : ''})`,
            `Trigger: ${opBonus.trigger}`,
            `Effect: ${opBonus.effect}`,
            manifestDetails,
            ownership
        ]
            .filter(Boolean)
            .join('\n');
    }

    if (!bonus) {
        return `${requiredPieces}-piece bonus\nNo perk details in manifest.\n${ownership}`;
    }

    return [bonus.name, bonus.description, ownership].filter(Boolean).join('\n');
}

export function ArmorSetFields(props: Pick<GearSettingsProps, 'onSetRequirementChange' | 'selectableSets' | 'setSelections'>) {
    function nextRequirement(current: SetSelectionValue, value: SetSelectionValue) {
        return current === value ? '0' : value;
    }

    const opSets = () => props.selectableSets.filter((set) => set.opBonuses.length > 0);
    const regularSets = () => props.selectableSets.filter((set) => set.opBonuses.length === 0);

    function renderSetCard(set: AvailableArmorSet) {
        const selected = () => props.setSelections[set.id] ?? '0';
        const canRequire = (requiredPieces: 2 | 4) => set.count >= requiredPieces;
        const hasOpBonus = (requiredPieces: 2 | 4) => set.opBonuses.some((bonus) => bonus.requiredPieces === requiredPieces);
        const updateRequirement = (requiredPieces: 2 | 4) => {
            if (!canRequire(requiredPieces)) {
                return;
            }

            props.onSetRequirementChange(set.id, nextRequirement(selected(), String(requiredPieces) as SetSelectionValue));
        };

        return (
            <div class={setRow} data-op={set.opBonuses.length > 0} data-unavailable={set.count < 2}>
                <span class={setName} title={set.name}>
                    <span class={setNameText}>{set.name}</span>
                </span>
                <span class={setCount} title={`${set.count} owned compatible pieces`}>
                    {set.count}
                </span>
                <fieldset class={segmentedControl} aria-label={`${set.name} requirement`}>
                    <button
                        class={`${segmentButton} ${hasOpBonus(2) ? opSegmentButton : ''}`}
                        type="button"
                        title={setBonusTooltip(set, 2)}
                        aria-disabled={!canRequire(2)}
                        data-disabled={!canRequire(2)}
                        data-op={hasOpBonus(2)}
                        data-selected={selected() === '2'}
                        onClick={() => updateRequirement(2)}
                    >
                        2
                    </button>
                    <button
                        class={`${segmentButton} ${hasOpBonus(4) ? opSegmentButton : ''}`}
                        type="button"
                        title={setBonusTooltip(set, 4)}
                        aria-disabled={!canRequire(4)}
                        data-disabled={!canRequire(4)}
                        data-op={hasOpBonus(4)}
                        data-selected={selected() === '4'}
                        onClick={() => updateRequirement(4)}
                    >
                        4
                    </button>
                </fieldset>
            </div>
        );
    }

    return (
        <Show when={props.selectableSets.length > 0} fallback={<p class={muted}>No armor set catalog loaded yet.</p>}>
            <div class={setList}>
                <Show when={opSets().length > 0}>
                    <section class={setSection}>
                        <div class={setSectionTitle} data-op="true">
                            OP bonuses
                        </div>
                        <div class={setGrid}>
                            <For each={opSets()}>{(set) => renderSetCard(set)}</For>
                        </div>
                    </section>
                </Show>

                <Show when={regularSets().length > 0}>
                    <section class={setSection}>
                        <Show when={opSets().length > 0}>
                            <div class={setSectionTitle}>Other sets</div>
                        </Show>
                        <div class={setGrid}>
                            <For each={regularSets()}>{(set) => renderSetCard(set)}</For>
                        </div>
                    </section>
                </Show>
            </div>
        </Show>
    );
}

export function ArmorSetControls(props: Pick<GearSettingsProps, 'onSetRequirementChange' | 'selectableSets' | 'setSelections'>) {
    return (
        <ControlSection title="Sets">
            <ArmorSetFields
                onSetRequirementChange={props.onSetRequirementChange}
                selectableSets={props.selectableSets}
                setSelections={props.setSelections}
            />
        </ControlSection>
    );
}

export function GearSettings(props: GearSettingsProps) {
    return (
        <div class={gearGrid}>
            <ExoticControls
                availableExotics={props.availableExotics}
                onExoticChange={props.onExoticChange}
                selectedExoticItemHash={props.selectedExoticItemHash}
            />

            <ArmorSetControls
                onSetRequirementChange={props.onSetRequirementChange}
                selectableSets={props.selectableSets}
                setSelections={props.setSelections}
            />
        </div>
    );
}
