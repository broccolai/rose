import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

export const OVERLAY_BACKDROP_STYLES = {
    bg: 'color-mix(in srgb, var(--rose-bg) 52%, transparent)',
    backdropFilter: 'blur(20px) saturate(114%)',
    color: 'var(--rose-muted)',
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        bg: 'radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--rose-accent) 12%, transparent), transparent 34%), linear-gradient(180deg, transparent, color-mix(in srgb, var(--rose-bg) 18%, transparent))'
    },
    '& > *': {
        position: 'relative',
        zIndex: 1
    }
};

export const OVERLAY_PANEL_STYLES = {
    border: '1px solid color-mix(in srgb, var(--rose-text) 10%, var(--rose-border))',
    borderRadius: 'var(--rose-radius-lg)',
    bg: 'linear-gradient(180deg, color-mix(in srgb, var(--rose-surface) 84%, transparent), color-mix(in srgb, var(--rose-surface-soft) 88%, transparent))',
    backdropFilter: 'blur(28px) saturate(112%)',
    boxShadow: '0 28px 90px color-mix(in srgb, #000 36%, transparent), inset 0 1px 0 color-mix(in srgb, var(--rose-text) 8%, transparent)'
};

export const OVERLAY_TITLE_STYLES = {
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontWeight: 820,
    lineHeight: 1.08,
    textAlign: 'center'
};

export const OVERLAY_STATUS_PILL_STYLES = {
    maxW: 'min(620px, 100%)',
    px: '0.8rem',
    py: '0.45rem',
    border: '1px solid color-mix(in srgb, var(--rose-accent) 24%, transparent)',
    borderRadius: 'var(--rose-radius-sm)',
    bg: 'color-mix(in srgb, var(--rose-accent) 9%, var(--rose-surface-soft))',
    color: 'var(--rose-muted-strong)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.78rem',
    fontWeight: 720,
    lineHeight: 1.35,
    textAlign: 'center'
};

export const OVERLAY_ACTION_BUTTON_STYLES = {
    minH: '38px',
    px: '1rem',
    border: '1px solid var(--rose-border)',
    borderRadius: 'var(--rose-radius-sm)',
    bg: 'var(--rose-surface-soft)',
    color: 'var(--rose-text)',
    fontFamily: MONO_FONT_FAMILY,
    fontSize: '0.76rem',
    fontWeight: 760,
    cursor: 'pointer',
    transition: 'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
    _hover: {
        bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))',
        borderColor: 'color-mix(in srgb, var(--rose-accent) 45%, var(--rose-border))',
        transform: 'translateY(-1px)'
    }
};
