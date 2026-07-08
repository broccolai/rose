export const PANE_SCROLL_STYLES = {
    minW: 0,
    minH: 0,
    overflow: { lg: 'auto' },
    pr: { lg: 'var(--rose-space-sm)' },
    mr: { lg: 'calc(var(--rose-space-xs) * -1)' },
    pb: { lg: 'var(--rose-space-sm)' },
    scrollbarGutter: { lg: 'stable' },
    scrollbarWidth: 'thin',
    scrollbarColor: 'color-mix(in srgb, var(--rose-accent) 38%, var(--rose-border)) transparent',
    '&::-webkit-scrollbar': {
        w: '0.45rem'
    },
    '&::-webkit-scrollbar-track': {
        bg: 'transparent'
    },
    '&::-webkit-scrollbar-thumb': {
        borderRadius: '999px',
        bg: 'color-mix(in srgb, var(--rose-muted) 26%, transparent)',
        border: '2px solid transparent',
        backgroundClip: 'content-box'
    },
    '&:hover::-webkit-scrollbar-thumb': {
        bg: 'color-mix(in srgb, var(--rose-accent) 48%, var(--rose-muted) 22%)',
        backgroundClip: 'content-box'
    }
} as const;
