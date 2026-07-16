import { styled } from '@panda/jsx';
import type { WeaponDefinition, WeaponFilterState } from '@rose/weapon-model';
import Check from 'lucide-solid/icons/check';
import LoaderCircle from 'lucide-solid/icons/loader-circle';
import RefreshCw from 'lucide-solid/icons/refresh-cw';
import Search from 'lucide-solid/icons/search';
import X from 'lucide-solid/icons/x';
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { bungieAssetUrl } from '@/features/weapons/catalog';

interface WeaponSearchProps {
    filters: WeaponFilterState;
    weapons: WeaponDefinition[];
    total: number;
    selectedHash: number | undefined;
    loading: boolean;
    error: string;
    onFiltersChange: (next: Partial<WeaponFilterState>) => void;
    onClearFilters: () => void;
    onRetry: () => void;
    onSelect: (weapon: WeaponDefinition) => void;
}

const SearchRoot = styled('div', {
    base: {
        position: 'relative',
        zIndex: 30,
        w: '100%'
    }
});

const SearchControl = styled('div', {
    base: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1rem minmax(0, 1fr) max-content',
        alignItems: 'center',
        gap: '0.55rem',
        h: '2.55rem',
        px: '0.8rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted)',
        transition: 'border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
        '&:focus-within': {
            borderColor: 'color-mix(in srgb, var(--rose-accent) 58%, var(--rose-border-strong))',
            bg: 'var(--rose-surface)',
            boxShadow: '0 0 0 3px color-mix(in srgb, var(--rose-accent) 11%, transparent)'
        },
        '& > svg': { w: '1rem', h: '1rem', strokeWidth: 1.9 },
        '&[data-loading="true"] > svg:last-child': { animation: 'rose-spin 900ms linear infinite' }
    }
});

const SearchInput = styled('input', {
    base: {
        minW: 0,
        w: '100%',
        h: '100%',
        p: 0,
        border: 0,
        bg: 'transparent',
        color: 'var(--rose-text)',
        fontSize: '0.78rem',
        outline: 'none',
        _placeholder: { color: 'var(--rose-muted)' },
        _disabled: { cursor: 'not-allowed' }
    }
});

const SearchAction = styled('button', {
    base: {
        display: 'grid',
        placeItems: 'center',
        w: '1.65rem',
        h: '1.65rem',
        p: 0,
        border: 0,
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'transparent',
        color: 'var(--rose-muted)',
        outline: 'none',
        _hover: { bg: 'var(--rose-surface-raised)', color: 'var(--rose-text)' },
        _focusVisible: { outline: '2px solid color-mix(in srgb, var(--rose-accent) 38%, transparent)' },
        '& svg': { w: '0.9rem', h: '0.9rem' }
    }
});

const Shortcut = styled('kbd', {
    base: {
        display: { base: 'none', sm: 'inline-grid' },
        placeItems: 'center',
        minW: '1.45rem',
        h: '1.35rem',
        px: '0.35rem',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-muted)',
        fontFamily: 'inherit',
        fontSize: '0.58rem',
        fontWeight: 750,
        lineHeight: 1
    }
});

const ResultsSurface = styled('div', {
    base: {
        position: 'absolute',
        top: 'calc(100% + 0.5rem)',
        left: 0,
        right: 0,
        display: 'grid',
        gridTemplateRows: 'max-content minmax(0, 1fr) max-content',
        maxH: 'min(30rem, calc(100dvh - 6.5rem))',
        overflow: 'hidden',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        boxShadow: '0 1.25rem 3rem color-mix(in srgb, #000 48%, transparent), 0 0 0 1px color-mix(in srgb, #fff 2%, transparent)'
    }
});

const ResultsHeader = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        minH: '2.35rem',
        px: '0.75rem',
        borderBottom: '1px solid var(--rose-border)',
        color: 'var(--rose-muted)',
        fontSize: '0.64rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        '& span:last-child': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }
    }
});

const ResultsList = styled('div', {
    base: {
        minH: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        scrollbarGutter: 'stable'
    }
});

const WeaponResult = styled('button', {
    base: {
        display: 'grid',
        gridTemplateColumns: '2.75rem minmax(0, 1fr) 1rem',
        alignItems: 'center',
        gap: '0.7rem',
        w: '100%',
        minH: '3.65rem',
        p: '0.45rem 0.75rem',
        border: 0,
        borderBottom: '1px solid color-mix(in srgb, var(--rose-border) 68%, transparent)',
        bg: 'transparent',
        color: 'var(--rose-text)',
        textAlign: 'left',
        outline: 'none',
        transition: 'background-color 100ms ease',
        _hover: { bg: 'var(--rose-surface-soft)' },
        _focusVisible: { bg: 'var(--rose-surface-raised)', boxShadow: 'inset 2px 0 0 var(--rose-accent)' },
        '&[aria-current="true"]': { bg: 'color-mix(in srgb, var(--rose-accent) 8%, var(--rose-surface-soft))' },
        '& > svg': { w: '0.9rem', h: '0.9rem', color: 'var(--rose-accent)', strokeWidth: 2.2 }
    }
});

const WeaponIcon = styled('img', {
    base: {
        display: 'block',
        w: '2.75rem',
        h: '2.75rem',
        borderRadius: 'var(--rose-radius-xs)',
        bg: 'var(--rose-surface-raised)',
        objectFit: 'cover'
    }
});

const WeaponDetails = styled('span', {
    base: { display: 'grid', gap: '0.18rem', minW: 0 }
});

const WeaponName = styled('strong', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-text)',
        fontSize: '0.76rem',
        fontWeight: 760,
        lineHeight: 1.2,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    }
});

const WeaponMeta = styled('span', {
    base: {
        overflow: 'hidden',
        color: 'var(--rose-muted)',
        fontSize: '0.63rem',
        lineHeight: 1.25,
        textOverflow: 'ellipsis',
        textTransform: 'capitalize',
        whiteSpace: 'nowrap'
    }
});

const Empty = styled('div', {
    base: {
        display: 'grid',
        placeItems: 'center',
        minH: '7rem',
        p: '1rem',
        color: 'var(--rose-muted)',
        fontSize: '0.72rem',
        textAlign: 'center'
    }
});

const ResultsFooter = styled('div', {
    base: {
        display: 'flex',
        alignItems: 'center',
        minH: '2rem',
        px: '0.75rem',
        borderTop: '1px solid var(--rose-border)',
        color: 'var(--rose-muted)',
        fontSize: '0.58rem'
    }
});

export const WeaponSearch = (props: WeaponSearchProps) => {
    let searchInput: HTMLInputElement | undefined;
    const [open, setOpen] = createSignal(false);
    const hasQuery = () => props.filters.query.trim().length > 0;
    const disabled = () => props.loading || Boolean(props.error);

    onMount(() => {
        const focusSearch = (event: KeyboardEvent) => {
            if (event.key.toLocaleLowerCase() !== 'k' || event.isComposing) return;
            const commandShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
            const shiftShortcut = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
            if (!commandShortcut && !shiftShortcut) return;
            event.preventDefault();
            searchInput?.focus();
            setOpen(true);
        };
        document.addEventListener('keydown', focusSearch);
        onCleanup(() => document.removeEventListener('keydown', focusSearch));
    });

    const selectWeapon = (weapon: WeaponDefinition) => {
        props.onSelect(weapon);
        props.onClearFilters();
        setOpen(false);
        searchInput?.blur();
    };

    const moveFromSearch = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (hasQuery()) props.onClearFilters();
            else searchInput?.blur();
            setOpen(false);
            return;
        }
        if (event.key !== 'ArrowDown' || !hasQuery()) return;
        const firstResult = event.currentTarget.closest('[data-weapon-search]')?.querySelector<HTMLButtonElement>('[data-weapon-result]');
        if (!firstResult) return;
        event.preventDefault();
        firstResult.focus();
    };

    return (
        <SearchRoot
            data-weapon-search="true"
            onFocusIn={() => setOpen(true)}
            onFocusOut={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
            }}
        >
            <SearchControl data-loading={props.loading}>
                <Search aria-hidden="true" />
                <SearchInput
                    ref={(element) => {
                        searchInput = element;
                    }}
                    type="text"
                    role="searchbox"
                    inputmode="search"
                    value={props.filters.query}
                    placeholder={
                        props.loading
                            ? 'Loading weapons...'
                            : props.error
                              ? 'Weapon search unavailable'
                              : 'Search weapons, perks, sources...'
                    }
                    aria-label="Search weapons"
                    aria-keyshortcuts="Shift+K Control+K Meta+K"
                    aria-expanded={open() && hasQuery()}
                    aria-controls="weapon-search-results"
                    autocomplete="off"
                    spellcheck={false}
                    disabled={disabled()}
                    onInput={(event) => {
                        props.onFiltersChange({ query: event.currentTarget.value });
                        setOpen(true);
                    }}
                    onKeyDown={moveFromSearch}
                />
                <Show
                    when={!props.loading && !props.error}
                    fallback={
                        props.error ? (
                            <SearchAction type="button" aria-label="Retry weapon catalog" title="Retry" onClick={props.onRetry}>
                                <RefreshCw aria-hidden="true" />
                            </SearchAction>
                        ) : (
                            <LoaderCircle aria-hidden="true" />
                        )
                    }
                >
                    <Show when={hasQuery()} fallback={<Shortcut aria-hidden="true">K</Shortcut>}>
                        <SearchAction
                            type="button"
                            aria-label="Clear weapon search"
                            title="Clear search"
                            onClick={() => {
                                props.onClearFilters();
                                searchInput?.focus();
                            }}
                        >
                            <X aria-hidden="true" />
                        </SearchAction>
                    </Show>
                </Show>
            </SearchControl>

            <Show when={open() && hasQuery()}>
                <ResultsSurface id="weapon-search-results" role="region" aria-label="Weapon search results">
                    <ResultsHeader>
                        <span>{props.total.toLocaleString()} results</span>
                    </ResultsHeader>
                    <ResultsList>
                        <Show when={props.weapons.length > 0} fallback={<Empty>No matching weapons</Empty>}>
                            <For each={props.weapons}>
                                {(weapon, index) => (
                                    <WeaponResult
                                        type="button"
                                        data-weapon-result="true"
                                        aria-current={weapon.hash === props.selectedHash}
                                        title={`${weapon.name} - ${weapon.intrinsicName}`}
                                        onClick={() => selectWeapon(weapon)}
                                        onKeyDown={(event) => moveResultFocus(event, index(), searchInput)}
                                    >
                                        <WeaponIcon src={bungieAssetUrl(weapon.icon)} alt="" loading="lazy" />
                                        <WeaponDetails>
                                            <WeaponName>{weapon.name}</WeaponName>
                                            <WeaponMeta>
                                                {weapon.type} / {weapon.intrinsicName} / {formatSource(weapon.source, weapon.rarity)}
                                            </WeaponMeta>
                                        </WeaponDetails>
                                        <Show when={weapon.hash === props.selectedHash}>
                                            <Check aria-hidden="true" />
                                        </Show>
                                    </WeaponResult>
                                )}
                            </For>
                        </Show>
                    </ResultsList>
                    <Show when={props.total > props.weapons.length}>
                        <ResultsFooter>Showing the first {props.weapons.length.toLocaleString()} matches</ResultsFooter>
                    </Show>
                </ResultsSurface>
            </Show>
        </SearchRoot>
    );
};

const moveResultFocus = (
    event: KeyboardEvent & { currentTarget: HTMLButtonElement },
    index: number,
    searchInput: HTMLInputElement | undefined
) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.currentTarget.click();
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        searchInput?.focus();
        return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[data-weapon-result]') ?? [])];
    if (rows.length === 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && index === 0) {
        searchInput?.focus();
        return;
    }
    const nextIndex =
        event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[nextIndex]?.focus();
};

const formatSource = (source: string, rarity: WeaponDefinition['rarity']) => {
    if (!source) return rarity;
    if (/^Random Perks:/i.test(source)) return 'Legacy random roll';
    return source.replace(/^Source:\s*/i, '').replace(/[.]$/, '');
};
