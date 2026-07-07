import { ARMOR_STATS, type ArmorStat } from '@armor-calc';
import { styled } from '@panda/jsx';
import { For } from 'solid-js';

import { SelectInput, SelectWrap } from '@/features/armor/components/calculator-control-primitives';
import { STAT_LABELS } from '@/features/armor/display-metadata';

interface DumpControlsProps {
    dumpStat: ArmorStat | '';
    onDumpStatChange: (stat: string) => void;
}

const InlineControls = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
        minW: 0
    }
});

export function DumpControls(props: DumpControlsProps) {
    return (
        <InlineControls>
            <SelectWrap>
                <SelectInput value={props.dumpStat} onChange={(event) => props.onDumpStatChange(event.currentTarget.value)}>
                    <option value="">None</option>
                    <For each={ARMOR_STATS}>{(stat) => <option value={stat}>{STAT_LABELS[stat]}</option>}</For>
                </SelectInput>
            </SelectWrap>
        </InlineControls>
    );
}
