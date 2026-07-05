import { css } from '@panda/css';

export const MONO_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const UI_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const panel = css({
    w: '100%',
    minW: 0,
    alignSelf: 'start',
    boxSizing: 'border-box',
    border: '0',
    borderRadius: '0',
    p: { base: '16px', md: '20px 28px' },
    boxShadow: 'none'
});

export const row = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
});

export const field = css({
    display: 'grid',
    gap: '0.42rem',
    minW: 0
});

export const label = css({
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.76rem',
    lineHeight: 1,
    letterSpacing: 0,
    fontWeight: 650,
    color: 'var(--rose-muted)'
});

export const muted = css({
    color: 'var(--rose-muted)',
    lineHeight: 1.45,
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.74rem',
    letterSpacing: 0,
    textTransform: 'none'
});

export const sectionStack = css({
    display: 'grid',
    gap: '0.58rem',
    pb: '0.76rem',
    borderBottom: '1px solid var(--rose-border)',
    _last: {
        pb: 0,
        borderBottom: 0
    }
});

export const sectionTitle = css({
    m: 0,
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.86rem',
    lineHeight: 1,
    letterSpacing: 0,
    fontWeight: 720,
    color: 'var(--rose-text)'
});

export const input = css({
    w: '100%',
    minW: 0,
    boxSizing: 'border-box',
    minH: '38px',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.5rem',
    bg: 'var(--rose-surface-soft)',
    px: '0.72rem',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.86rem',
    lineHeight: 1.2,
    outline: 'none',
    transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
    _focusVisible: {
        borderColor: 'var(--rose-accent)',
        bg: 'var(--rose-surface-raised)',
        outline: '2px solid color-mix(in srgb, var(--rose-accent) 28%, transparent)',
        outlineOffset: '2px'
    },
    _disabled: {
        opacity: 0.42
    }
});

export const button = css({
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
});

export const secondaryButton = css({
    minH: '38px',
    px: '0.9rem',
    border: '1px solid var(--rose-border)',
    borderRadius: '0.5rem',
    bg: 'var(--rose-surface-soft)',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.82rem',
    letterSpacing: 0,
    fontWeight: 700,
    transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
    _hover: {
        bg: 'var(--rose-surface-raised)',
        color: 'var(--rose-text)',
        borderColor: 'var(--rose-border-strong)',
        transform: 'translateY(-1px)'
    },
    _disabled: {
        opacity: 0.55,
        cursor: 'not-allowed'
    }
});

export const actionGrid = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.32rem',
    '@media (max-width: 520px)': {
        gridTemplateColumns: '1fr'
    }
});
