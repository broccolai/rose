import type { SetSelectionValue } from '@/features/armor/calculator-preferences';

export const setSelectionRecordsEqual = (left: Record<string, SetSelectionValue>, right: Record<string, SetSelectionValue>): boolean => {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);
    return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => right[key] === value);
};
