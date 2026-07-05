import { css } from '@panda/css';
import { Show } from 'solid-js';

import { button, MONO_FONT_FAMILY, row, UI_FONT_FAMILY } from '@/features/armor/components/ui-styles';

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

const topPanel = css({
    position: 'relative',
    display: 'grid',
    gap: '0.75rem',
    w: '100%'
});

const topBar = css({
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: { base: '1fr', md: 'auto minmax(0, 1fr)' },
    alignItems: 'center',
    gap: '1rem',
    minH: '38px'
});

const headingGroup = css({
    display: 'grid',
    gap: '2px'
});

const title = css({
    m: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontFamily: UI_FONT_FAMILY,
    fontSize: { base: '20px', md: '23px' },
    lineHeight: 1.08,
    fontWeight: 720
});

const canvasMark = css({
    display: 'block',
    flex: '0 0 auto',
    w: { base: '34px', md: '38px' },
    h: { base: '34px', md: '38px' },
    objectFit: 'contain',
    opacity: 0.9
});

const titleProduct = css({
    letterSpacing: '0.055em'
});

const actions = css({
    justifySelf: { base: 'stretch', md: 'end' },
    alignItems: 'center',
    '& button': {
        flex: { base: '1 1 auto', md: '0 0 auto' }
    }
});

const avatarButton = css({
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
});

const avatarImage = css({
    w: '100%',
    h: '100%',
    objectFit: 'cover'
});

function BrandMark() {
    return (
        <div class={headingGroup}>
            <h1 class={title}>
                <img class={canvasMark} src="/canvas.png" alt="rose" />
                <span class={titleProduct}>ARMOR</span>
            </h1>
        </div>
    );
}

function avatarInitial(label?: string) {
    return label?.trim().charAt(0).toUpperCase() || 'B';
}

function ToolbarActions(props: Omit<AppToolbarProps, 'progress'>) {
    return (
        <div class={`${row} ${actions}`}>
            <Show
                when={props.authenticated}
                fallback={
                    <button class={button} type="button" onClick={props.onSignIn}>
                        Sign in
                    </button>
                }
            >
                <button class={button} type="button" onClick={props.onRefresh} disabled={props.loading}>
                    Refresh
                </button>
                <div class={avatarButton} title={props.avatarLabel ?? 'Signed in'} role="img" aria-label={props.avatarLabel ?? 'Signed in'}>
                    <Show when={props.avatarUrl} fallback={avatarInitial(props.avatarLabel)}>
                        <img class={avatarImage} src={props.avatarUrl} alt="" />
                    </Show>
                </div>
            </Show>
        </div>
    );
}

export function AppToolbar(props: AppToolbarProps) {
    return (
        <div class={topPanel}>
            <div class={topBar}>
                <BrandMark />

                <ToolbarActions
                    authenticated={props.authenticated}
                    avatarLabel={props.avatarLabel}
                    avatarUrl={props.avatarUrl}
                    loading={props.loading}
                    onSignIn={props.onSignIn}
                    onRefresh={props.onRefresh}
                />
            </div>
        </div>
    );
}
