import { styled } from '@panda/jsx';
import { Eclipse, Hamburger, Moon, RefreshCw, Settings, Sun } from 'lucide-solid';
import { createEffect, createSignal, Match, onCleanup, Show, Switch } from 'solid-js';

import { APP_VERSION } from '@/app-version';
import { APP_THEME_LABELS, type AppTheme, VISIBLE_APP_THEMES } from '@/features/armor/app-theme';
import { useArmorCalculator } from '@/features/armor/armor-calculator-context';
import { AdvancedControlsBody } from '@/features/armor/components/advanced-controls';
import { MONO_FONT_FAMILY, UI_FONT_FAMILY } from '@/features/armor/components/ui-styles';

export type LoadProgress = {
    active: boolean;
    label: string;
    current: number;
    total: number;
    percent: number;
};

type AppToolbarProps = {
    authenticated: boolean;
    avatarLabel?: string | undefined;
    avatarUrl?: string | undefined;
    loading: boolean;
    theme: AppTheme;
    onSignIn: () => void;
    onRefresh: () => void;
    onThemeChange: (theme: AppTheme) => void;
};

const TopPanel = styled('div', {
    base: {
        position: 'relative',
        display: 'grid',
        gap: 'var(--rose-space-sm)',
        w: '100%'
    }
});

const TopBar = styled('div', {
    base: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: { base: '1fr', md: 'auto minmax(0, 1fr)' },
        alignItems: 'center',
        gap: 'var(--rose-space-md)',
        minH: 'var(--rose-control-height)'
    }
});

const HeadingGroup = styled('div', {
    base: {
        display: 'grid',
        gap: '2px'
    }
});

const Title = styled('h1', {
    base: {
        m: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--rose-space-xs)',
        fontFamily: UI_FONT_FAMILY,
        fontSize: { base: '20px', md: '23px' },
        lineHeight: 1.08,
        fontWeight: 720
    }
});

const CanvasMark = styled('img', {
    base: {
        display: 'block',
        flex: '0 0 auto',
        w: { base: '34px', md: '38px' },
        h: { base: '34px', md: '38px' },
        objectFit: 'contain',
        opacity: 0.9
    }
});

const TitleProduct = styled('span', {
    base: {
        letterSpacing: '0.055em'
    }
});

const VersionBadge = styled('span', {
    base: {
        alignSelf: 'center',
        color: 'var(--rose-muted)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: 0,
        lineHeight: 1,
        transform: 'translateY(1px)'
    }
});

const Actions = styled('div', {
    base: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--rose-space-xs)',
        justifySelf: { base: 'stretch', md: 'end' },
        justifyContent: { base: 'space-between', md: 'flex-end' },
        alignItems: 'center',
        '& > [data-action-button]': {
            flex: { base: '1 1 auto', md: '0 0 auto' }
        }
    }
});

const ThemeCycleButton = styled('button', {
    base: {
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        w: 'var(--rose-control-height)',
        h: 'var(--rose-control-height)',
        p: 0,
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)',
        color: 'var(--rose-muted-strong)',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--rose-text) 8%, transparent)',
        transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
        _hover: {
            bg: 'var(--rose-surface-raised)',
            borderColor: 'color-mix(in srgb, var(--rose-accent) 54%, var(--rose-border-strong))',
            color: 'var(--rose-text)',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--rose-accent) 16%, transparent)',
            transform: 'translateY(-1px)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
            outlineOffset: '2px'
        },
        _disabled: {
            cursor: 'not-allowed',
            opacity: 0.68,
            _hover: {
                bg: 'var(--rose-surface-soft)',
                borderColor: 'var(--rose-border)',
                color: 'var(--rose-muted-strong)',
                boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--rose-text) 8%, transparent)',
                transform: 'none'
            }
        },
        '& svg': {
            w: '1.1rem',
            h: '1.1rem',
            strokeWidth: 2.1
        },
        '&[data-loading="true"] svg': {
            animation: 'rose-spin 900ms linear infinite'
        }
    }
});

const SettingsMenu = styled('div', {
    base: {
        position: 'relative',
        display: 'grid'
    }
});

const SettingsPopover = styled('div', {
    base: {
        position: 'absolute',
        top: 'calc(100% + var(--rose-space-xs))',
        right: 0,
        zIndex: 20,
        w: 'min(24rem, calc(100vw - 2rem))',
        p: 'var(--rose-space-sm)',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)',
        boxShadow: '0 18px 45px color-mix(in srgb, #000 34%, transparent)',
        '&::before': {
            content: '""',
            position: 'absolute',
            top: '-0.35rem',
            right: '1rem',
            w: '0.65rem',
            h: '0.65rem',
            borderLeft: '1px solid var(--rose-border)',
            borderTop: '1px solid var(--rose-border)',
            bg: 'var(--rose-surface)',
            transform: 'rotate(45deg)'
        }
    }
});

const ToolbarButton = styled('button', {
    base: {
        minH: 'var(--rose-control-height)',
        px: 'var(--rose-control-padding-x)',
        border: '1px solid var(--rose-button)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-button)',
        color: 'var(--rose-button-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.82rem',
        letterSpacing: 0,
        fontWeight: 760,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
        _hover: {
            bg: '#c292ff',
            borderColor: '#c292ff',
            transform: 'translateY(-1px)'
        },
        _disabled: {
            opacity: 0.55,
            cursor: 'not-allowed'
        }
    }
});

const AvatarButton = styled('div', {
    base: {
        display: 'grid',
        placeItems: 'center',
        w: 'var(--rose-control-height)',
        h: 'var(--rose-control-height)',
        p: 0,
        overflow: 'hidden',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-text)',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        fontWeight: 800,
        lineHeight: 1
    }
});

const AvatarImage = styled('img', {
    base: {
        w: '100%',
        h: '100%',
        objectFit: 'cover'
    }
});

function BrandMark(props: { theme: AppTheme }) {
    const isBurger = () => props.theme === 'burger';

    return (
        <HeadingGroup>
            <Title>
                <CanvasMark src={isBurger() ? '/burger-removebg.png' : '/canvas.png'} alt={isBurger() ? 'burger' : 'rose'} />
                <TitleProduct>{isBurger() ? 'BURGER' : 'ARMOR'}</TitleProduct>
                <VersionBadge>{APP_VERSION}</VersionBadge>
            </Title>
        </HeadingGroup>
    );
}

function avatarInitial(label?: string) {
    return label?.trim().charAt(0).toUpperCase() || 'B';
}

function nextTheme(theme: AppTheme) {
    const currentIndex = VISIBLE_APP_THEMES.indexOf(theme as (typeof VISIBLE_APP_THEMES)[number]);
    return VISIBLE_APP_THEMES[(currentIndex + 1) % VISIBLE_APP_THEMES.length];
}

function ThemeIcon(props: { theme: AppTheme }) {
    return (
        <Switch fallback={<Moon aria-hidden="true" />}>
            <Match when={props.theme === 'burger'}>
                <Hamburger aria-hidden="true" />
            </Match>
            <Match when={props.theme === 'dim'}>
                <Eclipse aria-hidden="true" />
            </Match>
            <Match when={props.theme === 'light'}>
                <Sun aria-hidden="true" />
            </Match>
        </Switch>
    );
}

function ToolbarActions(props: AppToolbarProps) {
    let settingsMenuElement: HTMLDivElement | undefined;
    const calculator = useArmorCalculator();
    const controls = calculator.controls;
    const actions = calculator.actions;
    const [settingsOpen, setSettingsOpen] = createSignal(false);
    const next = () => nextTheme(props.theme);
    const label = () => `Theme: ${APP_THEME_LABELS[props.theme]}. Switch to ${APP_THEME_LABELS[next()]}.`;
    const changeTheme = (event: MouseEvent) => {
        props.onThemeChange(event.shiftKey ? 'burger' : next());
    };

    createEffect(() => {
        if (!settingsOpen()) {
            return;
        }

        const closeOnPointerDown = (event: PointerEvent) => {
            if (settingsMenuElement?.contains(event.target as Node)) {
                return;
            }

            setSettingsOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSettingsOpen(false);
            }
        };

        document.addEventListener('pointerdown', closeOnPointerDown);
        document.addEventListener('keydown', closeOnEscape);
        onCleanup(() => {
            document.removeEventListener('pointerdown', closeOnPointerDown);
            document.removeEventListener('keydown', closeOnEscape);
        });
    });

    return (
        <Actions>
            <ThemeCycleButton type="button" aria-label={label()} title={label()} onClick={changeTheme}>
                <ThemeIcon theme={props.theme} />
            </ThemeCycleButton>
            <SettingsMenu ref={settingsMenuElement}>
                <ThemeCycleButton
                    type="button"
                    aria-label="Open advanced settings"
                    aria-expanded={settingsOpen()}
                    title="Advanced settings"
                    onClick={() => setSettingsOpen((open) => !open)}
                >
                    <Settings aria-hidden="true" />
                </ThemeCycleButton>
                <Show when={settingsOpen()}>
                    <SettingsPopover>
                        <AdvancedControlsBody
                            allowBalancedTuning={controls.allowBalancedTuning()}
                            armorSetDisplayMode={controls.armorSetDisplayMode()}
                            onlyFullyMasterworkedGear={controls.onlyFullyMasterworkedGear()}
                            onArmorSetDisplayModeChange={actions.setArmorSetDisplayMode}
                            onBalancedTuningChange={actions.setAllowBalancedTuning}
                            onOnlyFullyMasterworkedGearChange={actions.setOnlyFullyMasterworkedGear}
                        />
                    </SettingsPopover>
                </Show>
            </SettingsMenu>
            <Show
                when={props.authenticated}
                fallback={
                    <ToolbarButton type="button" data-action-button onClick={props.onSignIn}>
                        Sign in
                    </ToolbarButton>
                }
            >
                <ThemeCycleButton
                    type="button"
                    aria-label={props.loading ? 'Refreshing profile' : 'Refresh profile'}
                    title={props.loading ? 'Refreshing profile' : 'Refresh profile'}
                    disabled={props.loading}
                    data-loading={props.loading}
                    onClick={props.onRefresh}
                >
                    <RefreshCw aria-hidden="true" />
                </ThemeCycleButton>
                <AvatarButton title={props.avatarLabel ?? 'Signed in'} role="img" aria-label={props.avatarLabel ?? 'Signed in'}>
                    <Show when={props.avatarUrl} fallback={avatarInitial(props.avatarLabel)}>
                        <AvatarImage src={props.avatarUrl} alt="" />
                    </Show>
                </AvatarButton>
            </Show>
        </Actions>
    );
}

export function AppToolbar(props: AppToolbarProps) {
    return (
        <TopPanel>
            <TopBar>
                <BrandMark theme={props.theme} />

                <ToolbarActions
                    authenticated={props.authenticated}
                    avatarLabel={props.avatarLabel}
                    avatarUrl={props.avatarUrl}
                    loading={props.loading}
                    theme={props.theme}
                    onSignIn={props.onSignIn}
                    onRefresh={props.onRefresh}
                    onThemeChange={props.onThemeChange}
                />
            </TopBar>
        </TopPanel>
    );
}
