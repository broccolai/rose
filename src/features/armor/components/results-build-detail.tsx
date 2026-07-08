import { ARMOR_SLOTS, ARMOR_STATS, type ArmorBuild, type ArmorSlot } from '@armor-calc';
import { styled } from '@panda/jsx';
import { debounce } from '@solid-primitives/scheduled';
import { createSignal, For, Show } from 'solid-js';

import { ButtonGroup, TonalButton } from '@/features/armor/components/calculator-control-primitives';
import { DataTable } from '@/features/armor/components/data-table';
import { SLOT_LABELS } from '@/features/armor/display-metadata';
import { formatDimArmorQuery } from '@/features/armor/result-display';

interface ResultsBuildDetailProps {
    build: ArmorBuild;
    onEquipBuild?: ((build: ArmorBuild) => Promise<void>) | undefined;
    showTuningResults: boolean;
}

const DetailPanel = styled('div', {
    base: {
        bg: 'var(--rose-surface)',
        p: 0
    }
});

const DetailTableWrap = styled('div', {
    base: {
        w: '100%',
        maxW: '100%',
        overflowX: 'hidden',
        borderTop: '1px solid var(--rose-border)'
    }
});

const DetailActions = styled(ButtonGroup, {
    base: {
        p: 'var(--rose-space-sm)',
        borderTop: '1px solid var(--rose-border)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 36%, var(--rose-surface))'
    }
});

const PieceName = styled('span', {
    base: {
        minW: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 720
    }
});

const addonName = (build: ArmorBuild, slot: ArmorSlot, addonKey: 'statMod' | 'tuning'): string => {
    const addon = build.pieces[slot][addonKey];
    return addon && ARMOR_STATS.some((stat) => (addon.deltas[stat] ?? 0) !== 0) ? addon.name : '-';
};

const copyTextToClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
    } finally {
        textarea.remove();
    }
};

export function ResultsBuildDetail(props: ResultsBuildDetailProps) {
    const [copyState, setCopyState] = createSignal<'idle' | 'copied' | 'failed'>('idle');
    const [equipState, setEquipState] = createSignal<'idle' | 'equipping' | 'done' | 'failed'>('idle');
    const resetCopiedState = debounce(() => setCopyState('idle'), 1400);
    const resetCopyFailedState = debounce(() => setCopyState('idle'), 1800);
    const resetEquippedState = debounce(() => setEquipState('idle'), 1600);
    const resetEquipFailedState = debounce(() => setEquipState('idle'), 2200);

    const clearPendingButtonResets = () => {
        resetCopiedState.clear();
        resetCopyFailedState.clear();
        resetEquippedState.clear();
        resetEquipFailedState.clear();
    };

    const copyDimQuery = async () => {
        clearPendingButtonResets();
        try {
            await copyTextToClipboard(formatDimArmorQuery(props.build));
            setCopyState('copied');
            resetCopiedState();
        } catch {
            setCopyState('failed');
            resetCopyFailedState();
        }
    };

    const copyLabel = () => {
        if (copyState() === 'copied') {
            return 'Copied';
        }

        if (copyState() === 'failed') {
            return 'Copy failed';
        }

        return 'Copy DIM Query';
    };

    const equipBuild = async () => {
        if (!props.onEquipBuild || equipState() === 'equipping') {
            return;
        }

        clearPendingButtonResets();
        try {
            setEquipState('equipping');
            await props.onEquipBuild(props.build);
            setEquipState('done');
            resetEquippedState();
        } catch {
            setEquipState('failed');
            resetEquipFailedState();
        }
    };

    const equipLabel = () => {
        if (equipState() === 'equipping') {
            return 'Equipping...';
        }

        if (equipState() === 'done') {
            return 'Equipped';
        }

        if (equipState() === 'failed') {
            return 'Equip failed';
        }

        return 'Equip Items';
    };

    return (
        <DetailPanel>
            <DetailTableWrap>
                <DataTable data-density="compact" data-row-surface="soft">
                    <colgroup>
                        <col data-slot-column />
                        <col />
                        <col data-mod-column />
                        <Show when={props.showTuningResults}>
                            <col data-tuning-column />
                        </Show>
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Slot</th>
                            <th>Armor</th>
                            <th>Mod</th>
                            <Show when={props.showTuningResults}>
                                <th>Tuning</th>
                            </Show>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={ARMOR_SLOTS}>
                            {(slot) => {
                                const piece = () => props.build.pieces[slot];
                                return (
                                    <tr>
                                        <td data-muted>{SLOT_LABELS[slot]}</td>
                                        <td>
                                            <PieceName title={piece().item.name}>{piece().item.name}</PieceName>
                                        </td>
                                        <td data-muted>{addonName(props.build, slot, 'statMod')}</td>
                                        <Show when={props.showTuningResults}>
                                            <td data-muted>{addonName(props.build, slot, 'tuning')}</td>
                                        </Show>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </DataTable>
                <DetailActions>
                    <TonalButton type="button" onClick={copyDimQuery}>
                        {copyLabel()}
                    </TonalButton>
                    <TonalButton type="button" disabled={!props.onEquipBuild || equipState() === 'equipping'} onClick={equipBuild}>
                        {equipLabel()}
                    </TonalButton>
                </DetailActions>
            </DetailTableWrap>
        </DetailPanel>
    );
}
