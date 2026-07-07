import { ARMOR_SLOTS, ARMOR_STATS, type ArmorBuild, type ArmorSlot } from '@armor-calc';
import { styled } from '@panda/jsx';
import { debounce } from '@solid-primitives/scheduled';
import { createSignal, For, Show } from 'solid-js';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';
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

const DetailActions = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 'var(--rose-space-sm)',
        p: 'var(--rose-space-sm)',
        borderTop: '1px solid var(--rose-border)',
        bg: 'color-mix(in srgb, var(--rose-surface-soft) 36%, var(--rose-surface))',
        '@media (max-width: 560px)': {
            gridTemplateColumns: '1fr'
        }
    }
});

const DetailActionButton = styled('button', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '100%',
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        border: '1px solid color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
        color: 'var(--rose-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        fontWeight: 760,
        lineHeight: 1,
        letterSpacing: 0,
        cursor: 'pointer',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 5%, transparent)',
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease',
        _hover: {
            bg: 'color-mix(in srgb, var(--rose-accent) 14%, var(--rose-surface-raised))',
            borderColor: 'color-mix(in srgb, var(--rose-accent) 52%, var(--rose-border))'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 34%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            opacity: 0.5,
            cursor: 'not-allowed',
            _hover: {
                bg: 'color-mix(in srgb, var(--rose-accent) 7%, var(--rose-surface-raised))',
                borderColor: 'color-mix(in srgb, var(--rose-accent) 28%, var(--rose-border))'
            }
        }
    }
});

const DetailTable = styled('table', {
    base: {
        w: '100%',
        minW: 0,
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        '& th': {
            p: 'var(--rose-space-xs) var(--rose-space-sm)',
            color: 'var(--rose-muted)',
            bg: '#0a0a0c',
            borderBottom: '1px solid var(--rose-border)',
            textAlign: 'left',
            fontWeight: 720,
            lineHeight: 1.15
        },
        '& td': {
            p: 'var(--rose-space-xs) var(--rose-space-sm)',
            borderBottom: '1px solid var(--rose-border)',
            bg: 'color-mix(in srgb, var(--rose-surface-soft) 62%, transparent)',
            lineHeight: 1.2,
            verticalAlign: 'middle'
        },
        '& tbody tr:last-child td': {
            borderBottom: 0
        },
        '& td[data-muted]': {
            color: 'var(--rose-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }
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
                <DetailTable>
                    <colgroup>
                        <col style={{ width: '92px' }} />
                        <col style={{ width: 'auto' }} />
                        <col style={{ width: '126px' }} />
                        <Show when={props.showTuningResults}>
                            <col style={{ width: '142px' }} />
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
                </DetailTable>
                <DetailActions>
                    <DetailActionButton type="button" onClick={copyDimQuery}>
                        {copyLabel()}
                    </DetailActionButton>
                    <DetailActionButton type="button" disabled={!props.onEquipBuild || equipState() === 'equipping'} onClick={equipBuild}>
                        {equipLabel()}
                    </DetailActionButton>
                </DetailActions>
            </DetailTableWrap>
        </DetailPanel>
    );
}
