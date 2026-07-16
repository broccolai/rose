import { styled } from '@panda/jsx';
import type {
    WeaponCatalog,
    WeaponDefinition,
    WeaponEffectOption,
    WeaponEngineCalculation,
    WeaponMode,
    WeaponSelection,
    WeaponSocket
} from '@rose/weapon-model';
import AlertTriangle from 'lucide-solid/icons/alert-triangle';
import CheckCircle2 from 'lucide-solid/icons/check-circle-2';
import LoaderCircle from 'lucide-solid/icons/loader-circle';
import Minus from 'lucide-solid/icons/minus';
import { createMemo, For, Index, Show } from 'solid-js';
import { bungieAssetUrl, calculateManifestStats, plugChoicesForSocket } from '@/features/weapons/catalog';
import { MutedText, SectionHeading, SegmentButton, SegmentedControl, SelectInput } from '@/features/weapons/components/primitives';

type RollEditorProps = {
    catalog: WeaponCatalog;
    weapon: WeaponDefinition;
    selection: WeaponSelection;
    calculation: WeaponEngineCalculation | null;
    effectOptions: Record<string, WeaponEffectOption>;
    calculationStatus: 'idle' | 'loading' | 'ready' | 'error';
    mode: WeaponMode;
    onModeChange: (mode: WeaponMode) => void;
    onPlugChange: (socketIndex: number, plugHash: number) => void;
    onEffectChange: (plugHash: number, value: number) => void;
};

const Editor = styled('div', {
    base: {
        display: 'grid',
        alignContent: 'start',
        minW: 0
    }
});

const WeaponHeader = styled('section', {
    base: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: { base: '4.75rem minmax(0, 1fr)', sm: '5.5rem minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: '0.8rem 1rem',
        minH: '7.5rem',
        p: { base: '1rem', md: '1.15rem 1.25rem' },
        borderBottom: '1px solid var(--rose-border)',
        overflow: 'hidden',
        bg: 'var(--rose-surface)'
    }
});

const WeaponImage = styled('img', {
    base: {
        position: 'relative',
        zIndex: 1,
        display: 'block',
        w: { base: '4.75rem', sm: '5.5rem' },
        h: { base: '4.75rem', sm: '5.5rem' },
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-sm)',
        objectFit: 'cover',
        bg: 'var(--rose-surface-raised)'
    }
});

const HeaderText = styled('div', {
    base: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gap: '0.28rem',
        minW: 0
    }
});

const WeaponName = styled('h1', {
    base: {
        m: 0,
        overflowWrap: 'anywhere',
        color: 'var(--rose-text)',
        fontSize: { base: '1.18rem', md: '1.42rem' },
        fontWeight: 800,
        letterSpacing: 0,
        lineHeight: 1.08
    }
});

const WeaponType = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.3rem 0.55rem',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.72rem',
        fontWeight: 650,
        lineHeight: 1.25,
        textTransform: 'capitalize'
    }
});

const Source = styled('p', {
    base: {
        m: 0,
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.68rem',
        lineHeight: 1.3,
        textOverflow: 'ellipsis',
        whiteSpace: { base: 'normal', md: 'nowrap' }
    }
});

const HeaderControls = styled('div', {
    base: {
        gridColumn: { base: '1 / -1', sm: 'auto' },
        display: 'grid',
        justifyItems: { base: 'stretch', sm: 'end' },
        gap: '0.45rem'
    }
});

const Coverage = styled('span', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: { base: 'flex-start', sm: 'flex-end' },
        gap: '0.35rem',
        color: 'var(--rose-muted)',
        fontSize: '0.64rem',
        fontWeight: 700,
        lineHeight: 1,
        '& svg': { w: '0.8rem', h: '0.8rem' },
        '&[data-state="full"]': { color: 'var(--rose-formula-full)' },
        '&[data-state="partial"]': { color: 'var(--rose-formula-partial)' },
        '&[data-state="unavailable"], &[data-state="error"]': { color: 'var(--rose-warning)' },
        '&[data-state="loading"] svg': { animation: 'rose-spin 900ms linear infinite' }
    }
});

const Band = styled('section', {
    base: {
        display: 'grid',
        gap: '0.85rem',
        p: { base: '1rem', md: '1.1rem 1.25rem' },
        borderBottom: '1px solid var(--rose-border)'
    }
});

const BandHeader = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '0.75rem'
    }
});

const PerkScroller = styled('div', {
    base: {
        maxH: { base: '22rem', md: '26rem' },
        minW: 0,
        overflow: 'auto',
        overscrollBehavior: 'contain',
        scrollbarGutter: 'stable',
        borderTop: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)'
    }
});

const SocketColumns = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(var(--perk-column-count), minmax(4.5rem, 1fr))',
        alignItems: 'stretch',
        w: '100%',
        minW: 'calc(var(--perk-column-count) * 4.5rem)'
    }
});

const SocketColumn = styled('div', {
    base: {
        display: 'grid',
        gridTemplateRows: 'max-content 1fr',
        alignContent: 'start',
        justifyItems: 'center',
        minW: 0,
        borderRight: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)',
        _last: { borderRight: 0 }
    }
});

const SocketColumnHeader = styled('div', {
    base: {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'grid',
        alignContent: 'start',
        justifyItems: 'center',
        gap: '0.2rem',
        w: '100%',
        minH: '3.8rem',
        p: '0.55rem 0.28rem 0.45rem',
        bg: 'var(--rose-surface)',
        boxShadow: '0 1px 0 color-mix(in srgb, var(--rose-border) 68%, transparent)'
    }
});

const UpgradeSection = styled('div', {
    base: {
        display: 'grid',
        gap: '0.7rem'
    }
});

const UpgradeList = styled('div', {
    base: {
        display: 'grid',
        gap: '0.75rem'
    }
});

const UpgradeRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: '6.8rem minmax(0, 1fr)' },
        alignItems: 'start',
        gap: '0.4rem 0.8rem',
        minW: 0,
        pb: '0.75rem',
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)',
        _last: { pb: 0, borderBottom: 0 }
    }
});

const SocketLabel = styled('div', {
    base: {
        display: 'grid',
        alignContent: 'start',
        gap: '0.18rem',
        pt: '0.2rem',
        minW: 0
    }
});

const SocketName = styled('span', {
    base: {
        color: 'var(--rose-muted-strong)',
        fontSize: '0.67rem',
        fontWeight: 800,
        lineHeight: 1.2,
        textTransform: 'uppercase'
    }
});

const SelectedName = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.63rem',
        lineClamp: 2,
        lineHeight: 1.25,
        textOverflow: 'ellipsis',
        '&[data-layout="column"]': {
            minH: '1.58rem',
            textAlign: 'center'
        }
    }
});

const PlugGrid = styled('div', {
    base: {
        display: 'grid',
        gridAutoRows: '2.75rem',
        gap: '0.38rem',
        minW: 0,
        '&[data-layout="column"]': {
            gridTemplateColumns: '2.75rem',
            justifyContent: 'center',
            alignContent: 'start',
            w: '100%',
            p: '0.55rem 0.35rem 0.7rem'
        },
        '&[data-layout="row"]': {
            gridAutoFlow: 'column',
            gridAutoColumns: '2.75rem',
            gridTemplateRows: 'repeat(2, 2.75rem)',
            justifyContent: 'start',
            maxW: '100%',
            pb: '0.3rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            overscrollBehaviorX: 'contain'
        }
    }
});

const PlugButton = styled('button', {
    base: {
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        w: '2.75rem',
        h: '2.75rem',
        p: '0.16rem',
        overflow: 'hidden',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'var(--rose-plug-bg)',
        outline: 'none',
        transition: 'border-color 100ms ease, background-color 100ms ease, transform 100ms ease',
        _hover: {
            borderColor: 'var(--rose-border-strong)',
            bg: 'var(--rose-plug-hover)',
            transform: 'translateY(-1px)'
        },
        _focusVisible: { outline: '2px solid color-mix(in srgb, var(--rose-accent) 44%, transparent)', outlineOffset: '2px' },
        '&[aria-checked="true"]': {
            borderColor: 'var(--rose-accent)',
            bg: 'var(--rose-plug-selected)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--rose-accent) 45%, transparent)'
        },
        '&[data-enhanced="true"]::after': {
            content: '""',
            position: 'absolute',
            right: '0.18rem',
            bottom: '0.18rem',
            w: '0.35rem',
            h: '0.35rem',
            borderRadius: '50%',
            bg: '#efb85f',
            boxShadow: '0 0 0 1px var(--rose-bg)'
        },
        '& > svg': {
            w: '1.05rem',
            h: '1.05rem',
            color: 'var(--rose-muted)',
            strokeWidth: 1.8
        }
    }
});

const PlugIcon = styled('img', {
    base: {
        display: 'block',
        w: '100%',
        h: '100%',
        borderRadius: '2px',
        objectFit: 'cover'
    }
});

const Effects = styled('div', {
    base: {
        display: 'grid',
        gap: '0.55rem'
    }
});

const EffectRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr) auto', sm: 'minmax(10rem, 1fr) minmax(10rem, 15rem)' },
        alignItems: 'center',
        gap: '0.65rem',
        minH: '2.35rem',
        py: '0.35rem',
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 62%, transparent)',
        _last: { borderBottom: 0 }
    }
});

const EffectName = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.72rem',
        fontWeight: 700,
        lineHeight: 1.25,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const EffectDetails = styled('span', {
    base: {
        display: 'grid',
        gap: '0.2rem',
        minW: 0
    }
});

const EffectNote = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.62rem',
        lineHeight: 1.4
    }
});

const Toggle = styled('input', {
    base: {
        appearance: 'none',
        position: 'relative',
        justifySelf: 'end',
        w: '2.3rem',
        h: '1.25rem',
        m: 0,
        border: '1px solid var(--rose-border-strong)',
        borderRadius: '999px',
        bg: 'var(--rose-surface-raised)',
        outline: 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&::after': {
            content: '""',
            position: 'absolute',
            top: '2px',
            left: '2px',
            w: 'calc(1.25rem - 6px)',
            h: 'calc(1.25rem - 6px)',
            borderRadius: '50%',
            bg: 'var(--rose-muted-strong)',
            transition: 'transform 120ms ease, background-color 120ms ease'
        },
        _checked: {
            borderColor: 'var(--rose-accent)',
            bg: 'color-mix(in srgb, var(--rose-accent) 42%, var(--rose-surface-raised))',
            '&::after': { transform: 'translateX(1.02rem)', bg: 'var(--rose-text)' }
        },
        _focusVisible: { outline: '2px solid color-mix(in srgb, var(--rose-accent) 38%, transparent)', outlineOffset: '2px' }
    }
});

const RangeWrap = styled('span', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 2.1rem',
        alignItems: 'center',
        gap: '0.55rem',
        '& input': { w: '100%', accentColor: 'var(--rose-accent)' },
        '& output': {
            color: 'var(--rose-text)',
            fontSize: '0.72rem',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right'
        }
    }
});

const StatsGrid = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: '0.6rem 1rem'
    }
});

const StatRow = styled('div', {
    base: {
        display: 'grid',
        gridTemplateColumns: 'minmax(7rem, 1fr) 3rem',
        gap: '0.3rem 0.55rem',
        alignItems: 'center',
        minW: 0
    }
});

const StatName = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.67rem',
        lineHeight: 1.1,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const StatValue = styled('span', {
    base: {
        color: 'var(--rose-text)',
        fontSize: '0.68rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 750,
        textAlign: 'right'
    }
});

const StatTrack = styled('span', {
    base: {
        gridColumn: '1 / -1',
        display: 'block',
        w: '100%',
        h: '0.32rem',
        overflow: 'hidden',
        borderRadius: '999px',
        bg: 'var(--rose-slider-empty-a)'
    }
});

const StatFill = styled('span', {
    base: {
        display: 'block',
        h: '100%',
        borderRadius: '999px',
        bg: 'var(--rose-accent)',
        transition: 'width 120ms ease'
    }
});

const Metrics = styled('dl', {
    base: {
        display: 'grid',
        gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
        gap: '1px',
        m: 0,
        border: '1px solid var(--rose-border)',
        bg: 'var(--rose-border)',
        '& > div': {
            display: 'grid',
            gap: '0.25rem',
            minW: 0,
            p: '0.65rem',
            bg: 'var(--rose-surface-soft)'
        },
        '& dt': {
            overflow: 'hidden',
            color: 'var(--rose-muted)',
            fontSize: '0.6rem',
            fontWeight: 750,
            lineHeight: 1.1,
            textOverflow: 'ellipsis',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
        },
        '& dd': {
            m: 0,
            color: 'var(--rose-text)',
            fontSize: '0.83rem',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 750,
            lineHeight: 1
        }
    }
});

function displaySocketLabel(weapon: WeaponDefinition, socket: WeaponSocket) {
    const matches = weapon.sockets.filter((candidate) => candidate.label === socket.label);
    return matches.length > 1 ? `${socket.label} ${matches.indexOf(socket) + 1}` : socket.label;
}

function formatMetric(value: number | undefined, suffix = '') {
    return Number.isFinite(value) ? `${Number(value).toFixed(2)}${suffix}` : '—';
}

function isUpgradeSocket(socket: WeaponSocket) {
    const label = socket.label.toLocaleLowerCase();
    const category = socket.category.toLocaleLowerCase();
    return label === 'mod' || label === 'masterwork' || /(?:mods|masterworks|enhancers)/.test(category);
}

function SocketPicker(props: {
    catalog: WeaponCatalog;
    weapon: WeaponDefinition;
    selection: WeaponSelection;
    socket: WeaponSocket;
    layout: 'column' | 'row';
    onPlugChange: (socketIndex: number, plugHash: number) => void;
}) {
    const choices = () => plugChoicesForSocket(props.catalog, props.socket);
    const selectedHash = () => props.selection.plugs[String(props.socket.index)];
    const selectedPlug = () => props.catalog.plugs[String(selectedHash())];
    const label = () => displaySocketLabel(props.weapon, props.socket);
    const picker = () => (
        <PlugGrid
            data-layout={props.layout}
            role="radiogroup"
            aria-label={`${label()} perks`}
            aria-orientation={props.layout === 'column' ? 'vertical' : 'horizontal'}
        >
            <For each={choices()}>
                {(choice, index) => {
                    const plug = () => props.catalog.plugs[String(choice.hash)];
                    const plugName = () => plug()?.name ?? `Plug ${choice.hash}`;
                    const accessibleName = () => (choice.enhanced ? `${plugName()} (enhanced)` : plugName());
                    const selected = () => choice.hashes.includes(selectedHash());
                    return (
                        <PlugButton
                            class="weapon-plug-button"
                            type="button"
                            role="radio"
                            aria-label={accessibleName()}
                            aria-checked={selected()}
                            tabIndex={
                                selected() || (!choices().some((candidate) => candidate.hashes.includes(selectedHash())) && index() === 0)
                                    ? 0
                                    : -1
                            }
                            data-enhanced={choice.enhanced}
                            title={`${accessibleName()}\n${plug()?.description ?? ''}`}
                            onClick={() => props.onPlugChange(props.socket.index, choice.hash)}
                            onKeyDown={movePlugFocus}
                        >
                            <Show when={plug()?.icon} fallback={<Minus aria-hidden="true" />}>
                                <PlugIcon src={bungieAssetUrl(plug()?.icon ?? '')} alt="" loading="lazy" />
                            </Show>
                        </PlugButton>
                    );
                }}
            </For>
        </PlugGrid>
    );

    if (props.layout === 'column') {
        return (
            <SocketColumn>
                <SocketColumnHeader>
                    <SocketName>{label()}</SocketName>
                    <SelectedName data-layout="column" title={selectedPlug()?.description}>
                        {selectedPlug()?.name ?? 'None'}
                    </SelectedName>
                </SocketColumnHeader>
                {picker()}
            </SocketColumn>
        );
    }

    return (
        <UpgradeRow>
            <SocketLabel>
                <SocketName>{label()}</SocketName>
                <SelectedName title={selectedPlug()?.description}>{selectedPlug()?.name ?? 'None'}</SelectedName>
            </SocketLabel>
            {picker()}
        </UpgradeRow>
    );
}

export function RollEditor(props: RollEditorProps) {
    const manifestStats = createMemo(() => calculateManifestStats(props.catalog, props.weapon, props.selection));
    const stats = createMemo(() => props.calculation?.stats ?? manifestStats().map((stat) => ({ ...stat, total: stat.value })));
    const perkSockets = createMemo(() => props.weapon.sockets.filter((socket) => !isUpgradeSocket(socket)));
    const upgradeSockets = createMemo(() => props.weapon.sockets.filter(isUpgradeSocket));
    const effectEntries = createMemo(() => {
        const hashes = [...(props.weapon.intrinsicHash ? [props.weapon.intrinsicHash] : []), ...Object.values(props.selection.plugs)];
        return hashes.flatMap((hash) => {
            const option = props.effectOptions[String(hash)];
            const plug = props.catalog.plugs[String(hash)];
            return option && option.optionType !== 'STATIC' && plug ? [{ hash, option, name: plug.name }] : [];
        });
    });
    const coverageState = () =>
        props.calculationStatus === 'loading'
            ? 'loading'
            : props.calculationStatus === 'error'
              ? 'error'
              : (props.calculation?.coverage ?? 'unavailable');
    const coverageLabel = () => {
        if (props.calculationStatus === 'loading') return 'Calculating';
        if (props.calculationStatus === 'error') return 'Calculation error';
        if (props.calculation?.coverage === 'full') return `Oracle ${props.calculation.engineVersion}`;
        if (props.calculation?.coverage === 'partial') return 'Partial formulas';
        return 'Manifest stats';
    };

    return (
        <Editor aria-busy={props.calculationStatus === 'loading'}>
            <WeaponHeader>
                <WeaponImage src={bungieAssetUrl(props.weapon.icon)} alt="" />
                <HeaderText>
                    <WeaponName>{props.weapon.name}</WeaponName>
                    <WeaponType>
                        <span>{props.weapon.type}</span>
                        <span>{props.weapon.intrinsicName}</span>
                        <span>{props.weapon.element}</span>
                        <span>{props.weapon.ammo}</span>
                    </WeaponType>
                    <Show when={props.weapon.source}>
                        <Source title={props.weapon.source}>{props.weapon.source}</Source>
                    </Show>
                </HeaderText>
                <HeaderControls>
                    <SegmentedControl role="group" aria-label="Calculation mode">
                        <SegmentButton type="button" aria-pressed={props.mode === 'pvp'} onClick={() => props.onModeChange('pvp')}>
                            PvP
                        </SegmentButton>
                        <SegmentButton type="button" aria-pressed={props.mode === 'pve'} onClick={() => props.onModeChange('pve')}>
                            PvE
                        </SegmentButton>
                    </SegmentedControl>
                    <Coverage data-state={coverageState()} role="status" aria-live="polite">
                        {coverageState() === 'loading' ? (
                            <LoaderCircle aria-hidden="true" />
                        ) : coverageState() === 'full' ? (
                            <CheckCircle2 aria-hidden="true" />
                        ) : (
                            <AlertTriangle aria-hidden="true" />
                        )}
                        {coverageLabel()}
                    </Coverage>
                </HeaderControls>
            </WeaponHeader>

            <Band>
                <BandHeader>
                    <SectionHeading>Roll</SectionHeading>
                    <MutedText>{perkSockets().length} columns</MutedText>
                </BandHeader>
                <PerkScroller>
                    <SocketColumns style={{ '--perk-column-count': Math.max(1, perkSockets().length) }}>
                        <For each={perkSockets()}>
                            {(socket) => (
                                <SocketPicker
                                    catalog={props.catalog}
                                    weapon={props.weapon}
                                    selection={props.selection}
                                    socket={socket}
                                    layout="column"
                                    onPlugChange={props.onPlugChange}
                                />
                            )}
                        </For>
                    </SocketColumns>
                </PerkScroller>
                <Show when={upgradeSockets().length > 0}>
                    <UpgradeSection>
                        <SectionHeading>Upgrades</SectionHeading>
                        <UpgradeList>
                            <For each={upgradeSockets()}>
                                {(socket) => (
                                    <SocketPicker
                                        catalog={props.catalog}
                                        weapon={props.weapon}
                                        selection={props.selection}
                                        socket={socket}
                                        layout="row"
                                        onPlugChange={props.onPlugChange}
                                    />
                                )}
                            </For>
                        </UpgradeList>
                    </UpgradeSection>
                </Show>
            </Band>

            <Show when={effectEntries().length > 0}>
                <Band>
                    <SectionHeading>Effects</SectionHeading>
                    <Effects>
                        <Index each={effectEntries()}>
                            {(entry) => (
                                <EffectRow>
                                    <EffectDetails>
                                        <EffectName>{entry().name}</EffectName>
                                        <Show when={entry().option.modelingNote}>{(note) => <EffectNote>{note()}</EffectNote>}</Show>
                                    </EffectDetails>
                                    <EffectControl
                                        hash={entry().hash}
                                        option={entry().option}
                                        name={entry().name}
                                        value={props.selection.effects[String(entry().hash)] ?? 0}
                                        onChange={props.onEffectChange}
                                    />
                                </EffectRow>
                            )}
                        </Index>
                    </Effects>
                </Band>
            </Show>

            <Band>
                <BandHeader>
                    <SectionHeading>Stats</SectionHeading>
                    <MutedText>{props.mode.toUpperCase()}</MutedText>
                </BandHeader>
                <StatsGrid>
                    <For
                        each={stats()
                            .filter((stat) => !['Power', 'Ammo Generation', 'Magazine', 'Rounds Per Minute'].includes(stat.name))
                            .slice(0, 12)}
                    >
                        {(stat) => (
                            <StatRow data-stat={stat.name}>
                                <StatName title={stat.name}>{stat.name}</StatName>
                                <StatValue>{Math.round(stat.total)}</StatValue>
                                <StatTrack>
                                    <StatFill style={{ width: `${Math.max(0, Math.min(100, stat.total))}%` }} />
                                </StatTrack>
                            </StatRow>
                        )}
                    </For>
                </StatsGrid>
            </Band>

            <Band>
                <SectionHeading>Advanced</SectionHeading>
                <Metrics>
                    <div>
                        <dt>ADS range</dt>
                        <dd>{formatMetric(props.calculation?.range?.adsStart, 'm')}</dd>
                    </div>
                    <div>
                        <dt>Reload</dt>
                        <dd>{formatMetric(props.calculation?.reload?.reload, 's')}</dd>
                    </div>
                    <div>
                        <dt>ADS</dt>
                        <dd>{formatMetric(props.calculation?.handling?.ads, 's')}</dd>
                    </div>
                    <div>
                        <dt>Ready</dt>
                        <dd>{formatMetric(props.calculation?.handling?.ready, 's')}</dd>
                    </div>
                    <div>
                        <dt>Stow</dt>
                        <dd>{formatMetric(props.calculation?.handling?.stow, 's')}</dd>
                    </div>
                    <div>
                        <dt>Magazine</dt>
                        <dd>{props.calculation?.ammo?.magazine ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>Reserves</dt>
                        <dd>{formatReserves(props.calculation?.ammo?.reserves)}</dd>
                    </div>
                    <div>
                        <dt>RPM</dt>
                        <dd>{Math.round(props.calculation?.firing?.rpm ?? 0) || '—'}</dd>
                    </div>
                </Metrics>
            </Band>
        </Editor>
    );
}

function formatReserves(value: number | undefined) {
    if (value === undefined) return '—';
    return value >= 9999 ? '∞' : value;
}

function EffectControl(props: {
    hash: number;
    name: string;
    option: WeaponEffectOption;
    value: number;
    onChange: (hash: number, value: number) => void;
}) {
    if (props.option.optionType === 'TOGGLE') {
        return (
            <Toggle
                type="checkbox"
                checked={props.value > 0}
                aria-label={`${props.name} active`}
                onChange={(event) => props.onChange(props.hash, event.currentTarget.checked ? 1 : 0)}
            />
        );
    }
    if (props.option.optionType === 'OPTIONS') {
        return (
            <SelectInput
                value={props.value}
                aria-label={`${props.name} option`}
                onInput={(event) => props.onChange(props.hash, Number(event.currentTarget.value))}
            >
                <For each={props.option.options}>{(label, index) => <option value={index()}>{label}</option>}</For>
            </SelectInput>
        );
    }
    return (
        <RangeWrap>
            <input
                type="range"
                min={props.option.stacks[0]}
                max={props.option.stacks[1]}
                step="1"
                value={props.value}
                aria-label={`${props.name} stacks`}
                onInput={(event) => props.onChange(props.hash, Number(event.currentTarget.value))}
            />
            <output>{props.value}</output>
        </RangeWrap>
    );
}

function movePlugFocus(event: KeyboardEvent & { currentTarget: HTMLButtonElement }) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    if (buttons.length === 0) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(event.currentTarget);
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
        event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
}
