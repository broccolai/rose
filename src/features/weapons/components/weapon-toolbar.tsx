import { styled } from '@panda/jsx';
import Check from 'lucide-solid/icons/check';
import Eclipse from 'lucide-solid/icons/eclipse';
import GitCompareArrows from 'lucide-solid/icons/git-compare-arrows';
import Hamburger from 'lucide-solid/icons/hamburger';
import Moon from 'lucide-solid/icons/moon';
import Pin from 'lucide-solid/icons/pin';
import RotateCcw from 'lucide-solid/icons/rotate-ccw';
import Share2 from 'lucide-solid/icons/share-2';
import Shuffle from 'lucide-solid/icons/shuffle';
import Sun from 'lucide-solid/icons/sun';
import { type JSX, Match, Switch } from 'solid-js';

import { APP_VERSION } from '@/app-version';
import { ProductNav } from '@/components/product-nav';
import { APP_THEME_LABELS, type AppTheme, VISIBLE_APP_THEMES } from '@/features/armor/app-theme';
import { IconButton } from '@/features/weapons/components/primitives';

type WeaponToolbarProps = {
    search: JSX.Element;
    theme: AppTheme;
    copied: boolean;
    compareCount: number;
    disabled: boolean;
    pinDisabled: boolean;
    onThemeChange: (theme: AppTheme) => void;
    onShare: () => void;
    onRandomize: () => void;
    onReset: () => void;
    onPin: () => void;
    onNavigateAway: (event: MouseEvent) => void;
};

const Bar = styled('div', {
    base: {
        display: 'grid',
        gridTemplateAreas: { base: '"brand" "search" "actions"', sm: '"brand actions" "search search"' },
        gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: '0.65rem 1rem',
        '@media (min-width: 72rem)': {
            gridTemplateAreas: '"brand search actions"',
            gridTemplateColumns: 'minmax(17rem, 1fr) minmax(20rem, 34rem) minmax(17rem, 1fr)'
        }
    }
});

const Brand = styled('div', {
    base: {
        gridArea: 'brand',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        minW: 0
    }
});

const Title = styled('div', {
    base: {
        display: 'inline-grid',
        gridTemplateColumns: '1.9rem auto auto',
        alignItems: 'center',
        gap: '0.5rem',
        minW: 0
    }
});

const Mark = styled('img', {
    base: {
        w: '1.9rem',
        h: '1.9rem',
        objectFit: 'contain',
        opacity: 0.9
    }
});

const ProductName = styled('span', {
    base: {
        fontSize: { base: '1.05rem', md: '1.15rem' },
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '0.055em'
    }
});

const Version = styled('span', {
    base: {
        color: 'var(--rose-muted)',
        fontSize: '0.65rem',
        fontWeight: 750,
        lineHeight: 1
    }
});

const Actions = styled('div', {
    base: {
        gridArea: 'actions',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: { base: 'flex-start', sm: 'flex-end' },
        gap: '0.4rem',
        minW: 0
    }
});

const SearchSlot = styled('div', {
    base: {
        gridArea: 'search',
        justifySelf: 'stretch',
        minW: 0,
        w: '100%'
    }
});

const Count = styled('span', {
    base: {
        position: 'absolute',
        top: '-0.32rem',
        right: '-0.32rem',
        display: 'grid',
        placeItems: 'center',
        minW: '1rem',
        h: '1rem',
        px: '0.2rem',
        border: '1px solid var(--rose-bg)',
        borderRadius: '999px',
        bg: 'var(--rose-accent)',
        color: 'var(--rose-button-text)',
        fontSize: '0.58rem',
        fontWeight: 850,
        lineHeight: 1
    }
});

const PinButton = styled(IconButton, { base: { position: 'relative' } });

function nextTheme(theme: AppTheme) {
    const index = VISIBLE_APP_THEMES.indexOf(theme as (typeof VISIBLE_APP_THEMES)[number]);
    return VISIBLE_APP_THEMES[(index + 1) % VISIBLE_APP_THEMES.length];
}

function ThemeIcon(props: { theme: AppTheme }) {
    return (
        <Switch fallback={<Moon aria-hidden="true" />}>
            <Match when={props.theme === 'dim'}>
                <Eclipse aria-hidden="true" />
            </Match>
            <Match when={props.theme === 'light'}>
                <Sun aria-hidden="true" />
            </Match>
            <Match when={props.theme === 'burger'}>
                <Hamburger aria-hidden="true" />
            </Match>
        </Switch>
    );
}

export function WeaponToolbar(props: WeaponToolbarProps) {
    const next = () => nextTheme(props.theme);
    const themeLabel = () => `Theme: ${APP_THEME_LABELS[props.theme]}. Switch to ${APP_THEME_LABELS[next()]}.`;
    return (
        <Bar>
            <Brand>
                <Title>
                    <Mark src="/canvas.png" alt="rose" />
                    <ProductName>WEAPONS</ProductName>
                    <Version>{APP_VERSION}</Version>
                </Title>
                <ProductNav
                    active="weapons"
                    onNavigate={(destination, event) => {
                        if (destination === 'armor') props.onNavigateAway(event);
                    }}
                />
            </Brand>
            <SearchSlot>{props.search}</SearchSlot>
            <Actions>
                <IconButton type="button" disabled={props.disabled} aria-label="Reset roll" title="Reset roll" onClick={props.onReset}>
                    <RotateCcw aria-hidden="true" />
                </IconButton>
                <IconButton
                    type="button"
                    disabled={props.disabled}
                    aria-label="Randomize roll"
                    title="Randomize roll"
                    onClick={props.onRandomize}
                >
                    <Shuffle aria-hidden="true" />
                </IconButton>
                <IconButton
                    type="button"
                    disabled={props.disabled}
                    aria-label="Copy share link"
                    title="Copy share link"
                    onClick={props.onShare}
                >
                    {props.copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
                </IconButton>
                <PinButton
                    type="button"
                    disabled={props.pinDisabled}
                    aria-label="Pin for comparison"
                    title="Pin for comparison"
                    onClick={props.onPin}
                >
                    {props.compareCount > 0 ? <GitCompareArrows aria-hidden="true" /> : <Pin aria-hidden="true" />}
                    {props.compareCount > 0 ? <Count aria-hidden="true">{props.compareCount}</Count> : null}
                </PinButton>
                <IconButton
                    type="button"
                    aria-label={themeLabel()}
                    title={themeLabel()}
                    onClick={(event) => props.onThemeChange(event.shiftKey ? 'burger' : next())}
                >
                    <ThemeIcon theme={props.theme} />
                </IconButton>
            </Actions>
        </Bar>
    );
}
