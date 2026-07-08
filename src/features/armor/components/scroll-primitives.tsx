import { styled } from '@panda/jsx';

export const PaneScroll = styled('div', {
    base: {
        minW: 0,
        minH: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        pr: 'var(--rose-space-sm)',
        mr: 'calc(var(--rose-space-xs) * -1)',
        pb: 'var(--rose-space-sm)',
        scrollbarGutter: 'stable',
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
    }
});
