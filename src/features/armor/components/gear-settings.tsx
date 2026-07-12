import { styled } from '@panda/jsx';
import { ChevronDown, Star } from 'lucide-solid';
import { For, Show } from 'solid-js';

import type { SetSelectionValue } from '@/features/armor/calculator-preferences';
import { type AvailableArmorSet, type AvailableExotic, getArmorSetRequirementAvailability } from '@/features/armor/calculator-view-model';
import { CompactChoiceButton, CustomSelect } from '@/features/armor/components/calculator-control-primitives';
import { DataTable, DataTableFrame, DataTableSectionRow } from '@/features/armor/components/data-table';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
import { type ArmorSetDisplayMode, getArmorSetDisplayName } from '@/features/armor/result-display';

type GearSettingsProps = {
    selectedExoticItemHash: string;
    armorSetDisplayMode: ArmorSetDisplayMode;
    setSelections: Record<string, SetSelectionValue>;
    otherSetsCollapsed: boolean;
    availableExotics: AvailableExotic[];
    selectableSets: AvailableArmorSet[];
    planningMode: boolean;
    onExoticChange: (itemHash: string) => void;
    favoriteExoticItemHashes: number[];
    onToggleFavoriteExotic: (itemHash: number) => void;
    onSetRequirementChange: (setId: string, value: string) => void;
    onOtherSetsCollapsedChange: (collapsed: boolean) => void;
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
        fontWeight: 600,
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
        fontWeight: 700
    }
});

const SetList = styled(DataTableFrame, {
    base: {
        '--rose-op': '#d8b15f'
    }
});

const ExoticControlRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) var(--rose-control-height)',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

const FavoriteButton = styled('button', {
    base: {
        display: 'grid',
        placeItems: 'center',
        w: 'var(--rose-control-height)',
        h: 'var(--rose-control-height)',
        p: 0,
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
        _hover: {
            borderColor: 'var(--rose-border-strong)',
            bg: 'var(--rose-surface-raised)',
            color: 'var(--rose-text)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            cursor: 'not-allowed',
            opacity: 0.38
        },
        '&[data-selected="true"]': {
            borderColor: 'color-mix(in srgb, #d8b15f 58%, var(--rose-border))',
            color: '#e5c36d',
            bg: 'color-mix(in srgb, #d8b15f 10%, var(--rose-surface-soft))',
            '& svg': {
                fill: 'currentColor'
            }
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
        fontWeight: 600,
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

const SetSectionToggle = styled('button', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--rose-space-sm)',
        w: '100%',
        minH: '1rem',
        p: 0,
        border: 0,
        bg: 'transparent',
        color: 'inherit',
        font: 'inherit',
        letterSpacing: 'inherit',
        lineHeight: 1,
        textAlign: 'left',
        textTransform: 'inherit',
        cursor: 'pointer',
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '2px',
            borderRadius: 'var(--rose-radius-xs)'
        }
    }
});

const SetSectionMeta = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 'var(--rose-space-xs)',
        h: '1rem',
        flexShrink: 0
    }
});

const SetSectionCount = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        h: '1rem',
        color: 'var(--rose-muted)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0,
        lineHeight: 1,
        textTransform: 'none'
    }
});

const SetSectionChevron = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '1rem',
        h: '1rem',
        transform: 'rotate(0deg)',
        transition: 'transform 120ms ease',
        '&[data-collapsed="true"]': {
            transform: 'rotate(-90deg)'
        }
    }
});

export function ExoticPicker(
    props: Pick<
        GearSettingsProps,
        'availableExotics' | 'favoriteExoticItemHashes' | 'onExoticChange' | 'onToggleFavoriteExotic' | 'selectedExoticItemHash'
    > & { labelText?: string | false }
) {
    const favoriteHashes = () => new Set(props.favoriteExoticItemHashes);
    const selectedExotic = () => props.availableExotics.find((exotic) => String(exotic.itemHash) === props.selectedExoticItemHash);
    const selectedIsFavorite = () => Boolean(selectedExotic() && favoriteHashes().has(selectedExotic()?.itemHash ?? 0));
    const options = () => [
        { value: '', label: 'None' },
        ...[...props.availableExotics]
            .sort((left, right) => Number(favoriteHashes().has(right.itemHash)) - Number(favoriteHashes().has(left.itemHash)))
            .map((exotic) => ({
                value: String(exotic.itemHash),
                label: exotic.name,
                trailingContent: favoriteHashes().has(exotic.itemHash)
                    ? () => <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                    : undefined
            }))
    ];

    return (
        <Field as="div">
            <Show when={props.labelText !== false}>
                <LabelLine>
                    {props.labelText ?? 'Choose one'}
                    <Show when={props.selectedExoticItemHash}>
                        <ExoticBadge>Exotic</ExoticBadge>
                    </Show>
                </LabelLine>
            </Show>
            <ExoticControlRow>
                <CustomSelect
                    ariaLabel="Exotic armor"
                    value={props.selectedExoticItemHash}
                    options={options()}
                    onChange={props.onExoticChange}
                />
                <FavoriteButton
                    type="button"
                    disabled={!selectedExotic()}
                    data-selected={selectedIsFavorite()}
                    aria-label={selectedIsFavorite() ? 'Remove exotic from favorites' : 'Add exotic to favorites'}
                    title={selectedIsFavorite() ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={() => {
                        const exotic = selectedExotic();
                        if (exotic) {
                            props.onToggleFavoriteExotic(exotic.itemHash);
                        }
                    }}
                >
                    <Star size={17} strokeWidth={2} aria-hidden="true" />
                </FavoriteButton>
            </ExoticControlRow>
        </Field>
    );
}

function setBonusTooltip(
    set: AvailableArmorSet,
    requiredPieces: 2 | 4,
    usableSlotCount: number,
    canSelect: boolean,
    planningMode: boolean
) {
    const bonus = set.bonuses.find((setBonus) => setBonus.requiredPieces === requiredPieces);
    const ownership = `${planningMode ? 'Available' : 'Owned'} slots ${Math.min(usableSlotCount, requiredPieces)} / ${requiredPieces}.`;
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
        | 'onOtherSetsCollapsedChange'
        | 'otherSetsCollapsed'
        | 'planningMode'
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
            getArmorSetRequirementAvailability(
                props.selectableSets,
                props.setSelections,
                set.id,
                requiredPieces,
                blockedSlots(),
                props.planningMode ? 'catalog' : 'owned'
            );
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
                        title={setBonusTooltip(set, 2, availability(2).usableSlotCount, canRequire(2), props.planningMode)}
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
                        title={setBonusTooltip(set, 4, availability(4).usableSlotCount, canRequire(4), props.planningMode)}
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
                            <DataTableSectionRow>
                                <td colSpan={3}>
                                    <SetSectionToggle
                                        type="button"
                                        aria-expanded={!props.otherSetsCollapsed}
                                        onClick={() => props.onOtherSetsCollapsedChange(!props.otherSetsCollapsed)}
                                    >
                                        <span>Other sets</span>
                                        <SetSectionMeta>
                                            <SetSectionCount>{regularSets().length}</SetSectionCount>
                                            <SetSectionChevron data-collapsed={props.otherSetsCollapsed} aria-hidden="true">
                                                <ChevronDown size={13} strokeWidth={2} />
                                            </SetSectionChevron>
                                        </SetSectionMeta>
                                    </SetSectionToggle>
                                </td>
                            </DataTableSectionRow>
                            <Show when={!props.otherSetsCollapsed}>
                                <For each={regularSets()}>{(set) => renderSetRow(set)}</For>
                            </Show>
                        </Show>
                    </tbody>
                </DataTable>
            </SetList>
        </Show>
    );
}
