import type { DestinyClass } from '@rose/armor-domain';

import type { CalculatorPreferences, SetSelectionValue } from '@/features/armor/calculator-preferences';
import { reconcileSelectedExotic, reconcileSetSelections } from '@/features/armor/calculator-view-model';
import type { NormalizedArmorProfile } from '@/features/armor/types';

export interface PrepareLoadedCalculatorStateInput {
    profile: NormalizedArmorProfile;
    currentCharacterId: string;
    currentExoticItemHash: string;
    currentSetSelections: Record<string, SetSelectionValue>;
    savedPreferences: CalculatorPreferences | null;
}

export interface PreparedLoadedCalculatorState {
    characterId: string;
    characterClass: DestinyClass;
    selectedExoticItemHash: string;
    setSelections: Record<string, SetSelectionValue>;
}

export const prepareLoadedCalculatorState = ({
    profile,
    currentCharacterId,
    currentExoticItemHash,
    currentSetSelections,
    savedPreferences
}: PrepareLoadedCalculatorStateInput): PreparedLoadedCalculatorState => {
    const desiredCharacterId = currentCharacterId || savedPreferences?.selectedCharacterId || '';
    const desiredExoticItemHash = currentExoticItemHash || savedPreferences?.selectedExoticItemHash || '';
    const selectedCharacter = profile.characters.find((character) => character.characterId === desiredCharacterId) ?? profile.characters[0];
    const characterId = selectedCharacter?.characterId ?? '';
    const characterClass = selectedCharacter?.classType ?? 'any';

    return {
        characterId,
        characterClass,
        selectedExoticItemHash: reconcileSelectedExotic(profile, characterClass, desiredExoticItemHash),
        setSelections: reconcileSetSelections(profile, characterClass, currentSetSelections)
    };
};
