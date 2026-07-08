import { styled } from '@panda/jsx';
import { For, Show } from 'solid-js';

import type { CharacterButtonClass, CharacterButtonOption } from '@/features/armor/calculator-view-model';
import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

const FieldGroup = styled('div', {
    base: {
        display: 'grid',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

const FieldLabel = styled('span', {
    base: {
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.76rem',
        lineHeight: 1,
        letterSpacing: 0,
        fontWeight: 600,
        color: 'var(--rose-muted)'
    }
});

const CharacterButtonGrid = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 'var(--rose-space-sm)',
        maxW: 'none'
    }
});

const CharacterButton = styled('button', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minH: 'var(--rose-control-height)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
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

interface CharacterPickerProps {
    labelText?: string | false;
    options: CharacterButtonOption[];
    selectedCharacterId: string;
    onSelect: (characterId: string) => void;
}

const ClassIcon = (props: { classType: CharacterButtonClass }) => <ClassIconGlyph data-class={props.classType} aria-hidden="true" />;

export function CharacterPicker(props: CharacterPickerProps) {
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
