import { styled } from '@panda/jsx';
import { Show } from 'solid-js';

import { APP_VERSION } from '@/app-version';
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
    avatarLabel?: string;
    avatarUrl?: string;
    loading: boolean;
    onSignIn: () => void;
    onRefresh: () => void;
};

const TopPanel = styled('div', {
    base: {
        position: 'relative',
        display: 'grid',
        gap: '0.75rem',
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
        gap: '1rem',
        minH: '38px'
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
        gap: '0.45rem',
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
        gap: '6px',
        justifySelf: { base: 'stretch', md: 'end' },
        alignItems: 'center',
        '& button': {
            flex: { base: '1 1 auto', md: '0 0 auto' }
        }
    }
});

const ToolbarButton = styled('button', {
    base: {
        minH: '38px',
        px: '0.9rem',
        border: '1px solid var(--rose-button)',
        borderRadius: '0.5rem',
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
        w: '38px',
        h: '38px',
        p: 0,
        overflow: 'hidden',
        border: '1px solid var(--rose-border-strong)',
        borderRadius: '0.65rem',
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

function BrandMark() {
    return (
        <HeadingGroup>
            <Title>
                <CanvasMark src="/canvas.png" alt="rose" />
                <TitleProduct>ARMOR</TitleProduct>
                <VersionBadge>{APP_VERSION}</VersionBadge>
            </Title>
        </HeadingGroup>
    );
}

function avatarInitial(label?: string) {
    return label?.trim().charAt(0).toUpperCase() || 'B';
}

function ToolbarActions(props: Omit<AppToolbarProps, 'progress'>) {
    return (
        <Actions>
            <Show
                when={props.authenticated}
                fallback={
                    <ToolbarButton type="button" onClick={props.onSignIn}>
                        Sign in
                    </ToolbarButton>
                }
            >
                <ToolbarButton type="button" onClick={props.onRefresh} disabled={props.loading}>
                    Refresh
                </ToolbarButton>
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
                <BrandMark />

                <ToolbarActions
                    authenticated={props.authenticated}
                    avatarLabel={props.avatarLabel}
                    avatarUrl={props.avatarUrl}
                    loading={props.loading}
                    onSignIn={props.onSignIn}
                    onRefresh={props.onRefresh}
                />
            </TopBar>
        </TopPanel>
    );
}
