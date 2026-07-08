import { styled } from '@panda/jsx';
import { For, Show } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import { type AvailableArmorSet, type AvailableExotic, getArmorSetRequirementAvailability } from '@/features/armor/calculator-view-model';
import { CompactChoiceButton, SelectInput } from '@/features/armor/components/calculator-control-primitives';
import { DataTable, DataTableFrame, DataTableSectionRow } from '@/features/armor/components/data-table';
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
        borderRadius: 'var(--rose-radius-sm)',
        color: 'var(--rose-exotic)',
        bg: 'color-mix(in srgb, var(--rose-exotic) 10%, var(--rose-surface))',
        fontSize: '0.66rem',
        fontWeight: 760
    }
});

const SetList = styled(DataTableFrame, {
    base: {
        '--rose-op': '#d8b15f'
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
            <SelectInput value={props.selectedExoticItemHash} onChange={(event) => props.onExoticChange(event.currentTarget.value)}>
                <option value="">None</option>
                <For each={props.availableExotics}>{(exotic) => <option value={String(exotic.itemHash)}>{exotic.name}</option>}</For>
            </SelectInput>
        </Field>
    );
}

function setBonusTooltip(set: AvailableArmorSet, requiredPieces: 2 | 4, usableSlotCount: number, canSelect: boolean) {
    const bonus = set.bonuses.find((setBonus) => setBonus.requiredPieces === requiredPieces);
    const ownership = `Usable slots ${Math.min(usableSlotCount, requiredPieces)} / ${requiredPieces}.`;
    const availability = canSelect ? 'Slot-compatible with current choices.' : 'Not slot-compatible with current choices.';

    if (!bonus) {
        return `${requiredPieces}-piece bonus\nNo perk details in manifest.\n${ownership}\n${availability}`;
    }

    return [bonus.name, bonus.description, ownership, availability].filter(Boolean).join('\n');
}

export function ArmorSetFields(
    props: Pick<
        GearSettingsProps,
        | 'armorSetDisplayMode'
        | 'availableExotics'
        | 'onSetRequirementChange'
        | 'selectableSets'
        | 'selectedExoticItemHash'
        | 'setSelections'
    >
) {
    function nextRequirement(current: SetSelectionValue, value: SetSelectionValue) {
        return current === value ? '0' : value;
    }

    const blockedSlots = () => {
        const selectedHash = props.selectedExoticItemHash;
        const selectedExotic = selectedHash ? props.availableExotics.find((exotic) => String(exotic.itemHash) === selectedHash) : undefined;

        return selectedExotic ? [selectedExotic.slot] : [];
    };

    const opSets = () => props.selectableSets.filter((set) => set.opBonuses.length > 0);
    const regularSets = () => props.selectableSets.filter((set) => set.opBonuses.length === 0);

    function renderSetRow(set: AvailableArmorSet) {
        const selected = () => props.setSelections[set.id] ?? '0';
        const displayName = () => getArmorSetDisplayName(set, props.armorSetDisplayMode);
        const availability = (requiredPieces: 2 | 4) =>
            getArmorSetRequirementAvailability(props.selectableSets, props.setSelections, set.id, requiredPieces, blockedSlots());
        const canRequire = (requiredPieces: 2 | 4) => availability(requiredPieces).canSelect;
        const rowSelected = () => selected() === '2' || selected() === '4';
        const rowUnavailable = () => !canRequire(2) && !canRequire(4) && !rowSelected();
        const hasOpBonus = (requiredPieces: 2 | 4) => set.opBonuses.some((bonus) => bonus.requiredPieces === requiredPieces);
        const updateRequirement = (requiredPieces: 2 | 4) => {
            if (!canRequire(requiredPieces)) {
                return;
            }

            props.onSetRequirementChange(set.id, nextRequirement(selected(), String(requiredPieces) as SetSelectionValue));
        };

        return (
            <tr data-op={set.opBonuses.length > 0} data-selected={rowSelected()} data-unavailable={rowUnavailable()}>
                <SetNameCell title={props.armorSetDisplayMode === 'sources' ? set.name : displayName()}>
                    <SetName>{displayName()}</SetName>
                </SetNameCell>
                <td data-action>
                    <CompactChoiceButton
                        type="button"
                        title={setBonusTooltip(set, 2, availability(2).usableSlotCount, canRequire(2))}
                        disabled={!canRequire(2)}
                        aria-disabled={!canRequire(2)}
                        data-disabled={!canRequire(2)}
                        data-op={hasOpBonus(2)}
                        data-selected={selected() === '2'}
                        onClick={() => updateRequirement(2)}
                    >
                        2
                    </CompactChoiceButton>
                </td>
                <td data-action>
                    <CompactChoiceButton
                        type="button"
                        title={setBonusTooltip(set, 4, availability(4).usableSlotCount, canRequire(4))}
                        disabled={!canRequire(4)}
                        aria-disabled={!canRequire(4)}
                        data-disabled={!canRequire(4)}
                        data-op={hasOpBonus(4)}
                        data-selected={selected() === '4'}
                        onClick={() => updateRequirement(4)}
                    >
                        4
                    </CompactChoiceButton>
                </td>
            </tr>
        );
    }

    return (
        <Show when={props.selectableSets.length > 0} fallback={<MutedText>No armor set catalog loaded yet.</MutedText>}>
            <SetList>
                <DataTable>
                    <colgroup>
                        <col />
                        <col data-action-column />
                        <col data-action-column />
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
                            <DataTableSectionRow data-op="true">
                                <td colSpan={3}>OP bonuses</td>
                            </DataTableSectionRow>
                            <For each={opSets()}>{(set) => renderSetRow(set)}</For>
                        </Show>

                        <Show when={regularSets().length > 0}>
                            <Show when={opSets().length > 0}>
                                <DataTableSectionRow>
                                    <td colSpan={3}>Other sets</td>
                                </DataTableSectionRow>
                            </Show>
                            <For each={regularSets()}>{(set) => renderSetRow(set)}</For>
                        </Show>
                    </tbody>
                </DataTable>
            </SetList>
        </Show>
    );
}
