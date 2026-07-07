import { styled } from '@panda/jsx';
import { For, Show } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import type { AvailableArmorSet, AvailableExotic } from '@/features/armor/calculator-view-model';
import { ControlSection } from '@/features/armor/components/control-section';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { type ArmorSetDisplayMode, getArmorSetDisplayName } from '@/features/armor/result-display';

type GearSettingsProps = {
    selectedExoticItemHash: string;
    armorSetDisplayMode: ArmorSetDisplayMode;
    setSelections: Record<string, SetSelectionValue>;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    onExoticChange: (itemHash: string) => void;
    onSetRequirementChange: (setId: string, value: string) => void;
};

const GearGrid = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        alignItems: 'start',
        minW: 0,
        '--rose-op': '#d8b15f'
    }
});

const Field = styled('label', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

const LabelLine = styled('span', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--rose-space-xs)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.76rem',
        lineHeight: 1,
        letterSpacing: 0,
        fontWeight: 650,
        color: 'var(--rose-muted)'
    }
});

const ExoticBadge = styled('span', {
    base: {
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
    }
});

const ExoticSelect = styled('select', {
    base: {
        w: '100%',
        minW: 0,
        boxSizing: 'border-box',
        minH: 'var(--rose-control-height)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        px: 'var(--rose-control-padding-x)',
        color: 'var(--rose-text)',
        colorScheme: 'dark',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.86rem',
        lineHeight: 1.2,
        outline: 'none',
        cursor: 'pointer',
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

const SetList = styled('div', {
    base: {
        minW: 0,
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        '--rose-op': '#d8b15f'
    }
});

const SetTable = styled('table', {
    base: {
        w: '100%',
        minW: 0,
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        '& th': {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            p: 'var(--rose-space-sm) var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)',
            bg: '#0a0a0c',
            color: 'var(--rose-muted)',
            fontSize: '0.68rem',
            lineHeight: 1,
            fontWeight: 720,
            letterSpacing: 0,
            textAlign: 'left'
        },
        '& th[data-action], & td[data-action]': {
            textAlign: 'center'
        },
        '& td': {
            p: 'var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)',
            color: 'var(--rose-text)',
            lineHeight: 1.2,
            verticalAlign: 'middle'
        },
        '& tbody tr[data-selected="true"]': {
            bg: 'color-mix(in srgb, var(--rose-accent) 9%, transparent)'
        },
        '& tbody tr[data-unavailable="true"]': {
            opacity: 0.58
        },
        '& tbody tr:hover': {
            bg: 'var(--rose-surface-soft)'
        },
        '& tbody tr[data-selected="true"]:hover': {
            bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))'
        }
    }
});

const SetSectionRow = styled('tr', {
    base: {
        '& td': {
            p: 'var(--rose-space-sm) var(--rose-space-xs) var(--rose-space-xs)',
            bg: 'var(--rose-surface)',
            color: 'var(--rose-muted)',
            fontSize: '0.66rem',
            fontWeight: 760,
            lineHeight: 1,
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
        },
        '&[data-op="true"] td': {
            color: 'var(--rose-op)'
        }
    }
});

const SetNameCell = styled('td', {
    base: {
        minW: 0,
        overflow: 'hidden'
    }
});

const SetName = styled('span', {
    base: {
        display: 'block',
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--rose-text)',
        fontWeight: 680,
        lineHeight: 1.2,
        whiteSpace: 'nowrap'
    }
});

const SetRequirementButton = styled('button', {
    base: {
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
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease',
        '&[data-disabled="false"][data-selected="false"]:hover': {
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        },
        '&[data-op="true"]': {
            color: 'color-mix(in srgb, var(--rose-op) 56%, var(--rose-muted) 44%)',
            bg: 'color-mix(in srgb, var(--rose-op) 8%, transparent)'
        },
        '&[data-disabled="true"]': {
            opacity: 0.28,
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
            borderColor: 'var(--rose-button)',
            color: 'var(--rose-button-text)',
            boxShadow: 'none'
        },
        '&[data-selected="true"][data-op="true"]': {
            bg: 'var(--rose-button)',
            borderColor: 'var(--rose-button)',
            color: 'var(--rose-button-text)'
        }
    }
});

const MutedText = styled('p', {
    base: {
        color: 'var(--rose-muted)',
        lineHeight: 1.45,
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        letterSpacing: 0,
        textTransform: 'none'
    }
});

export function ExoticPicker(
    props: Pick<GearSettingsProps, 'availableExotics' | 'onExoticChange' | 'selectedExoticItemHash'> & { labelText?: string | false }
) {
    return (
        <Field>
            <Show when={props.labelText !== false}>
                <LabelLine>
                    {props.labelText ?? 'Choose one'}
                    <Show when={props.selectedExoticItemHash}>
                        <ExoticBadge>Exotic</ExoticBadge>
                    </Show>
                </LabelLine>
            </Show>
            <ExoticSelect value={props.selectedExoticItemHash} onChange={(event) => props.onExoticChange(event.currentTarget.value)}>
                <option value="">None</option>
                <For each={props.availableExotics}>{(exotic) => <option value={String(exotic.itemHash)}>{exotic.name}</option>}</For>
            </ExoticSelect>
        </Field>
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
    const bonus = set.bonuses.find((setBonus) => setBonus.requiredPieces === requiredPieces);
    const ownership = `Own ${Math.min(set.count, requiredPieces)} / ${requiredPieces} compatible pieces.`;

    if (!bonus) {
        return `${requiredPieces}-piece bonus\nNo perk details in manifest.\n${ownership}`;
    }

    return [bonus.name, bonus.description, ownership].filter(Boolean).join('\n');
}

export function ArmorSetFields(
    props: Pick<GearSettingsProps, 'armorSetDisplayMode' | 'onSetRequirementChange' | 'selectableSets' | 'setSelections'>
) {
    function nextRequirement(current: SetSelectionValue, value: SetSelectionValue) {
        return current === value ? '0' : value;
    }

    const opSets = () => props.selectableSets.filter((set) => set.opBonuses.length > 0);
    const regularSets = () => props.selectableSets.filter((set) => set.opBonuses.length === 0);

    function renderSetRow(set: AvailableArmorSet) {
        const selected = () => props.setSelections[set.id] ?? '0';
        const displayName = () => getArmorSetDisplayName(set, props.armorSetDisplayMode);
        const canRequire = (requiredPieces: 2 | 4) => set.count >= requiredPieces;
        const rowSelected = () => selected() === '2' || selected() === '4';
        const hasOpBonus = (requiredPieces: 2 | 4) => set.opBonuses.some((bonus) => bonus.requiredPieces === requiredPieces);
        const updateRequirement = (requiredPieces: 2 | 4) => {
            if (!canRequire(requiredPieces)) {
                return;
            }

            props.onSetRequirementChange(set.id, nextRequirement(selected(), String(requiredPieces) as SetSelectionValue));
        };

        return (
            <tr data-op={set.opBonuses.length > 0} data-selected={rowSelected()} data-unavailable={set.count < 2}>
                <SetNameCell title={props.armorSetDisplayMode === 'sources' ? set.name : displayName()}>
                    <SetName>{displayName()}</SetName>
                </SetNameCell>
                <td data-action>
                    <SetRequirementButton
                        type="button"
                        title={setBonusTooltip(set, 2)}
                        disabled={!canRequire(2)}
                        aria-disabled={!canRequire(2)}
                        data-disabled={!canRequire(2)}
                        data-op={hasOpBonus(2)}
                        data-selected={selected() === '2'}
                        onClick={() => updateRequirement(2)}
                    >
                        2
                    </SetRequirementButton>
                </td>
                <td data-action>
                    <SetRequirementButton
                        type="button"
                        title={setBonusTooltip(set, 4)}
                        disabled={!canRequire(4)}
                        aria-disabled={!canRequire(4)}
                        data-disabled={!canRequire(4)}
                        data-op={hasOpBonus(4)}
                        data-selected={selected() === '4'}
                        onClick={() => updateRequirement(4)}
                    >
                        4
                    </SetRequirementButton>
                </td>
            </tr>
        );
    }

    return (
        <Show when={props.selectableSets.length > 0} fallback={<MutedText>No armor set catalog loaded yet.</MutedText>}>
            <SetList>
                <SetTable>
                    <colgroup>
                        <col />
                        <col style={{ width: '3.75rem' }} />
                        <col style={{ width: '3.75rem' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Set</th>
                            <th data-action>2</th>
                            <th data-action>4</th>
                        </tr>
                    </thead>
                    <tbody>
                        <Show when={opSets().length > 0}>
                            <SetSectionRow data-op="true">
                                <td colSpan={3}>OP bonuses</td>
                            </SetSectionRow>
                            <For each={opSets()}>{(set) => renderSetRow(set)}</For>
                        </Show>

                        <Show when={regularSets().length > 0}>
                            <Show when={opSets().length > 0}>
                                <SetSectionRow>
                                    <td colSpan={3}>Other sets</td>
                                </SetSectionRow>
                            </Show>
                            <For each={regularSets()}>{(set) => renderSetRow(set)}</For>
                        </Show>
                    </tbody>
                </SetTable>
            </SetList>
        </Show>
    );
}

export function ArmorSetControls(
    props: Pick<GearSettingsProps, 'armorSetDisplayMode' | 'onSetRequirementChange' | 'selectableSets' | 'setSelections'>
) {
    return (
        <ControlSection title="Sets">
            <ArmorSetFields
                armorSetDisplayMode={props.armorSetDisplayMode}
                onSetRequirementChange={props.onSetRequirementChange}
                selectableSets={props.selectableSets}
                setSelections={props.setSelections}
            />
        </ControlSection>
    );
}

export function GearSettings(props: GearSettingsProps) {
    return (
        <GearGrid>
            <ExoticControls
                availableExotics={props.availableExotics}
                onExoticChange={props.onExoticChange}
                selectedExoticItemHash={props.selectedExoticItemHash}
            />

            <ArmorSetControls
                armorSetDisplayMode={props.armorSetDisplayMode}
                onSetRequirementChange={props.onSetRequirementChange}
                selectableSets={props.selectableSets}
                setSelections={props.setSelections}
            />
        </GearGrid>
    );
}
