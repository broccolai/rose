import { styled } from '@panda/jsx';
import RotateCcw from 'lucide-solid/icons/rotate-ccw';
import Search from 'lucide-solid/icons/search';
import { For, onCleanup, onMount, Show } from 'solid-js';

import { bungieAssetUrl } from '@/features/weapons/catalog';
import { IconButton, MutedText, SectionHeading, TextInput } from '@/features/weapons/components/primitives';
import type { WeaponDefinition, WeaponFilterState } from '@/features/weapons/types';

type ExplorerPanelProps = {
    filters: WeaponFilterState;
    weapons: WeaponDefinition[];
    total: number;
    selectedHash?: number | undefined;
    hasMore: boolean;
    onFiltersChange: (next: Partial<WeaponFilterState>) => void;
    onClearFilters: () => void;
    onSelect: (weapon: WeaponDefinition) => void;
    onShowMore: () => void;
};

const Panel = styled('div', {
    base: {
        display: 'grid',
        gridTemplateRows: 'max-content minmax(0, 1fr)',
        h: { md: '100%' },
        minH: 0
    }
});

const FilterArea = styled('div', {
    base: {
        display: 'grid',
        gap: '0.55rem',
        p: '0.75rem 1rem 0.85rem',
        borderBottom: '1px solid var(--rose-border)'
    }
});

const SearchField = styled('label', {
    base: {
        position: 'relative',
        display: 'block',
        '& svg': {
            position: 'absolute',
            top: '50%',
            left: '0.7rem',
            w: '0.95rem',
            h: '0.95rem',
            color: 'var(--rose-muted)',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
        },
        '& input': {
            pl: '2.1rem'
        }
    }
});

const ResultsHeading = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '0.5rem'
    }
});

const ResultsMeta = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        '& button': { w: '1.8rem', h: '1.8rem' }
    }
});

const Results = styled('div', {
    base: {
        display: 'grid',
        alignContent: 'start',
        minH: 0,
        maxH: { base: '28rem', md: 'none' },
        overflow: 'auto',
        overscrollBehavior: 'contain'
    }
});

const WeaponRow = styled('button', {
    base: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '3rem minmax(0, 1fr)',
        gap: '0.65rem',
        alignItems: 'center',
        w: '100%',
        minH: '4.7rem',
        p: '0.55rem 0.75rem',
        border: 0,
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)',
        borderLeft: '3px solid transparent',
        bg: 'transparent',
        color: 'var(--rose-text)',
        textAlign: 'left',
        outline: 'none',
        transition: 'background-color 100ms ease, border-color 100ms ease',
        _hover: { bg: 'var(--rose-surface-soft)' },
        _focusVisible: { boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--rose-accent) 42%, transparent)' },
        '&[aria-pressed="true"]': {
            borderLeftColor: 'var(--rose-accent)',
            bg: 'var(--rose-surface-raised)'
        }
    }
});

const WeaponIcon = styled('img', {
    base: {
        display: 'block',
        w: '3rem',
        h: '3rem',
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'var(--rose-surface-raised)',
        objectFit: 'cover'
    }
});

const WeaponText = styled('span', {
    base: {
        display: 'grid',
        gap: '0.18rem',
        minW: 0
    }
});

const WeaponName = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-text)',
        fontSize: '0.8rem',
        fontWeight: 750,
        lineHeight: 1.15,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const WeaponMeta = styled('span', {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.65rem',
        lineHeight: 1.2,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const WeaponSource = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.59rem',
        lineHeight: 1.2,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const ElementDot = styled('span', {
    base: {
        flex: '0 0 auto',
        w: '0.45rem',
        h: '0.45rem',
        borderRadius: '50%',
        bg: 'var(--element-color, var(--rose-muted))',
        boxShadow: '0 0 0 1px color-mix(in srgb, var(--element-color, var(--rose-muted)) 62%, transparent)'
    }
});

const Empty = styled('div', {
    base: {
        display: 'grid',
        placeItems: 'center',
        minH: '9rem',
        p: '1rem',
        color: 'var(--rose-muted)',
        gap: '0.65rem',
        fontSize: '0.76rem',
        textAlign: 'center',
        '& button': {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            minH: '2.15rem',
            px: '0.7rem',
            border: '1px solid var(--rose-border)',
            borderRadius: 'var(--rose-radius-sm)',
            bg: 'var(--rose-surface-soft)',
            color: 'var(--rose-muted-strong)',
            fontSize: '0.68rem',
            fontWeight: 750,
            '& svg': { w: '0.85rem', h: '0.85rem' }
        }
    }
});

const MoreButton = styled('button', {
    base: {
        w: '100%',
        minH: '2.6rem',
        border: 0,
        borderBottom: '1px solid var(--rose-border)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted-strong)',
        fontSize: '0.7rem',
        fontWeight: 750,
        _hover: { bg: 'var(--rose-surface-raised)', color: 'var(--rose-text)' }
    }
});

const ELEMENT_COLORS: Record<WeaponDefinition['element'], string> = {
    kinetic: '#c8cbd0',
    arc: '#55b8e8',
    solar: '#ef8a45',
    void: '#a970ff',
    stasis: '#6e8fe8',
    strand: '#5bcf8a',
    unknown: '#85858e'
};

export function ExplorerPanel(props: ExplorerPanelProps) {
    let searchInput: HTMLInputElement | undefined;
    const hasActiveFilters = () => Boolean(props.filters.query);
    const selectedIsVisible = () => props.weapons.some((weapon) => weapon.hash === props.selectedHash);

    onMount(() => {
        const focusSearch = (event: KeyboardEvent) => {
            if (event.key.toLocaleLowerCase() !== 'k' || event.isComposing) return;
            const isCommandShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
            const isShiftShortcut = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
            if (!isCommandShortcut && !isShiftShortcut) return;
            if (isShiftShortcut && document.activeElement === searchInput) return;
            event.preventDefault();
            searchInput?.focus();
        };
        document.addEventListener('keydown', focusSearch);
        onCleanup(() => document.removeEventListener('keydown', focusSearch));
    });

    return (
        <Panel>
            <FilterArea>
                <ResultsHeading>
                    <SectionHeading>Arsenal</SectionHeading>
                    <ResultsMeta>
                        <MutedText>
                            {props.total.toLocaleString()} {props.total === 1 ? 'weapon' : 'weapons'}
                        </MutedText>
                        <Show when={hasActiveFilters()}>
                            <IconButton
                                type="button"
                                aria-label="Clear weapon filters"
                                title="Clear filters"
                                onClick={props.onClearFilters}
                            >
                                <RotateCcw aria-hidden="true" />
                            </IconButton>
                        </Show>
                    </ResultsMeta>
                </ResultsHeading>
                <SearchField>
                    <Search aria-hidden="true" />
                    <TextInput
                        ref={(element) => {
                            searchInput = element;
                        }}
                        type="search"
                        value={props.filters.query}
                        placeholder="Search weapons"
                        aria-label="Search weapons"
                        aria-keyshortcuts="Shift+K Control+K Meta+K"
                        autocomplete="off"
                        spellcheck={false}
                        onInput={(event) => props.onFiltersChange({ query: event.currentTarget.value })}
                    />
                </SearchField>
            </FilterArea>
            <Results>
                <Show
                    when={props.weapons.length > 0}
                    fallback={
                        <Empty>
                            <span>No matching weapons</span>
                            <Show when={hasActiveFilters()}>
                                <button type="button" onClick={props.onClearFilters}>
                                    <RotateCcw aria-hidden="true" />
                                    Clear filters
                                </button>
                            </Show>
                        </Empty>
                    }
                >
                    <For each={props.weapons}>
                        {(weapon, index) => (
                            <WeaponRow
                                type="button"
                                data-weapon-row="true"
                                aria-pressed={weapon.hash === props.selectedHash}
                                tabIndex={weapon.hash === props.selectedHash || (!selectedIsVisible() && index() === 0) ? 0 : -1}
                                title={`${weapon.name} · ${weapon.intrinsicName}\n${weapon.source || weapon.rarity} · #${weapon.hash}`}
                                onClick={() => props.onSelect(weapon)}
                                onKeyDown={(event) => moveResultFocus(event, index())}
                            >
                                <WeaponIcon src={bungieAssetUrl(weapon.icon)} alt="" loading="lazy" />
                                <WeaponText>
                                    <WeaponName>{weapon.name}</WeaponName>
                                    <WeaponMeta>
                                        <ElementDot style={{ '--element-color': ELEMENT_COLORS[weapon.element] }} />
                                        {weapon.type} · {weapon.intrinsicName}
                                    </WeaponMeta>
                                    <WeaponSource>
                                        {formatSource(weapon.source, weapon.rarity)} · #{weapon.hash}
                                    </WeaponSource>
                                </WeaponText>
                            </WeaponRow>
                        )}
                    </For>
                    <Show when={props.hasMore}>
                        <MoreButton type="button" onClick={props.onShowMore}>
                            Show more
                        </MoreButton>
                    </Show>
                </Show>
            </Results>
        </Panel>
    );
}

function moveResultFocus(event: KeyboardEvent & { currentTarget: HTMLButtonElement }, index: number) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[data-weapon-row="true"]') ?? [])];
    if (rows.length === 0) return;
    event.preventDefault();
    const nextIndex =
        event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[nextIndex]?.focus();
}

function formatSource(source: string, rarity: WeaponDefinition['rarity']) {
    if (!source) return rarity;
    if (/^Random Perks:/i.test(source)) return 'Legacy random roll';
    return source.replace(/^Source:\s*/i, '').replace(/[.]$/, '');
}
