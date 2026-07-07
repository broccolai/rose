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
        display: 'grid',
        gap: 'var(--rose-space-md)',
        minW: 0,
        maxH: '21rem',
        overflowY: 'auto',
        pr: 'var(--rose-space-xxs)',
        '--rose-op': '#d8b15f'
    }
});

const SetSection = styled('section', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        minW: 0
    }
});

const SetSectionTitle = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
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
    }
});

const SetGrid = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12.5rem), 1fr))',
        gap: 'var(--rose-space-sm)',
        minW: 0
    }
});

const SetRow = styled('div', {
    base: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: 'auto auto',
        alignItems: 'start',
        alignContent: 'space-between',
        gap: 'var(--rose-space-xs)',
        minW: 0,
        minH: '4rem',
        p: 'var(--rose-space-sm)',
        border: '1px solid transparent',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 82%, #000 18%)',
        transition: 'background-color 130ms ease, opacity 130ms ease, outline-color 130ms ease',
        '&[data-selected="true"]': {
            outline: '1px solid color-mix(in srgb, var(--rose-accent) 54%, transparent)',
            bg: 'color-mix(in srgb, var(--rose-accent) 10%, var(--rose-surface-soft))'
        },
        '&[data-unavailable="true"]': {
            bg: 'color-mix(in srgb, var(--rose-surface-soft) 54%, #000 46%)',
            opacity: 0.72,
            '& > span': {
                color: 'color-mix(in srgb, var(--rose-muted) 74%, #000 26%)'
            }
        }
    }
});

const SetName = styled('span', {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
        minW: 0,
        pr: 'var(--rose-space-xl)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        color: 'var(--rose-text)',
        fontWeight: 680,
        fontSize: '0.82rem',
        lineHeight: 1.15
    }
});

const SetNameText = styled('span', {
    base: {
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const SetCount = styled('span', {
    base: {
        position: 'absolute',
        top: 'var(--rose-space-sm)',
        right: 'var(--rose-space-sm)',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.76rem',
        fontWeight: 750,
        lineHeight: 1
    }
});

const SegmentedControl = styled('fieldset', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        m: 0,
        p: 0,
        h: 'var(--rose-control-compact-height)',
        minInlineSize: 0,
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        overflow: 'hidden',
        bg: 'var(--rose-surface)'
    }
});

const SegmentButton = styled('button', {
    base: {
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
            color: 'var(--rose-button-text)',
            boxShadow: 'none'
        },
        '&[data-selected="true"][data-op="true"]': {
            bg: 'var(--rose-button)',
            color: 'var(--rose-button-text)',
            boxShadow: 'inset 0 0 0 1px var(--rose-accent)'
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

    function renderSetCard(set: AvailableArmorSet) {
        const selected = () => props.setSelections[set.id] ?? '0';
        const displayName = () => getArmorSetDisplayName(set, props.armorSetDisplayMode);
        const canRequire = (requiredPieces: 2 | 4) => set.count >= requiredPieces;
        const cardSelected = () => selected() === '2' || selected() === '4';
        const hasOpBonus = (requiredPieces: 2 | 4) => set.opBonuses.some((bonus) => bonus.requiredPieces === requiredPieces);
        const updateRequirement = (requiredPieces: 2 | 4) => {
            if (!canRequire(requiredPieces)) {
                return;
            }

            props.onSetRequirementChange(set.id, nextRequirement(selected(), String(requiredPieces) as SetSelectionValue));
        };

        return (
            <SetRow data-op={set.opBonuses.length > 0} data-selected={cardSelected()} data-unavailable={set.count < 2}>
                <SetName title={props.armorSetDisplayMode === 'sources' ? set.name : displayName()}>
                    <SetNameText>{displayName()}</SetNameText>
                </SetName>
                <SetCount title={`${set.count} owned compatible pieces`}>{set.count}</SetCount>
                <SegmentedControl aria-label={`${displayName()} requirement`}>
                    <SegmentButton
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
                    </SegmentButton>
                    <SegmentButton
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
                    </SegmentButton>
                </SegmentedControl>
            </SetRow>
        );
    }

    return (
        <Show when={props.selectableSets.length > 0} fallback={<MutedText>No armor set catalog loaded yet.</MutedText>}>
            <SetList>
                <Show when={opSets().length > 0}>
                    <SetSection>
                        <SetSectionTitle data-op="true">OP bonuses</SetSectionTitle>
                        <SetGrid>
                            <For each={opSets()}>{(set) => renderSetCard(set)}</For>
                        </SetGrid>
                    </SetSection>
                </Show>

                <Show when={regularSets().length > 0}>
                    <SetSection>
                        <Show when={opSets().length > 0}>
                            <SetSectionTitle>Other sets</SetSectionTitle>
                        </Show>
                        <SetGrid>
                            <For each={regularSets()}>{(set) => renderSetCard(set)}</For>
                        </SetGrid>
                    </SetSection>
                </Show>
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
