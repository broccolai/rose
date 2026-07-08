import { styled } from '@panda/jsx';

import { MONO_FONT_FAMILY } from '@/features/armor/components/ui-styles';

export const DataTableFrame = styled('div', {
    base: {
        w: '100%',
        maxW: '100%',
        minW: 0,
        overflowX: 'hidden',
        scrollbarGutter: 'stable',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-md)',
        bg: 'var(--rose-surface)'
    }
});

export const DataTable = styled('table', {
    base: {
        w: '100%',
        minW: 0,
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        fontFamily: MONO_FONT_FAMILY,
        fontSize: '0.74rem',
        '& th': {
            p: 'var(--rose-space-sm) var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)',
            bg: 'var(--rose-table-header)',
            color: 'var(--rose-muted)',
            fontSize: '0.68rem',
            fontWeight: 720,
            letterSpacing: 0,
            lineHeight: 1,
            textAlign: 'left',
            whiteSpace: 'normal'
        },
        '& thead th': {
            position: 'sticky',
            top: 0,
            zIndex: 2
        },
        '& td': {
            p: 'var(--rose-space-xs)',
            borderBottom: '1px solid var(--rose-border)',
            color: 'var(--rose-text)',
            lineHeight: 1.2,
            verticalAlign: 'middle'
        },
        '&[data-density="comfortable"] td': {
            p: 'var(--rose-space-sm) var(--rose-space-xs)'
        },
        '&[data-density="compact"] th, &[data-density="compact"] td': {
            p: 'var(--rose-space-xs) var(--rose-space-sm)'
        },
        '&[data-row-surface="soft"] td': {
            bg: 'var(--rose-table-row)'
        },
        '& tbody tr:last-child td': {
            borderBottom: 0
        },
        '& th[data-action], & td[data-action]': {
            textAlign: 'center'
        },
        '& th[data-numeric], & td[data-numeric]': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums'
        },
        '& td[data-muted]': {
            color: 'var(--rose-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },
        '& td[data-text-cell]': {
            minW: 0,
            overflowWrap: 'anywhere',
            wordBreak: 'normal'
        },
        '& tbody tr[data-clickable="true"]': {
            cursor: 'pointer'
        },
        '& tbody tr[data-expanded="true"]': {
            bg: 'var(--rose-surface-raised)'
        },
        '& tbody tr[data-expanded="true"] td:first-child': {
            boxShadow: 'inset 3px 0 0 var(--rose-accent)'
        },
        '& tbody tr[data-selected="true"]': {
            bg: 'color-mix(in srgb, var(--rose-accent) 9%, transparent)'
        },
        '& tbody tr[data-unavailable="true"] td:not([data-action])': {
            color: 'var(--rose-control-disabled-text)',
            opacity: 0.78
        },
        '& tbody tr:hover': {
            bg: 'var(--rose-surface-soft)'
        },
        '& tbody tr[data-selected="true"]:hover': {
            bg: 'color-mix(in srgb, var(--rose-accent) 12%, var(--rose-surface-soft))'
        },
        '& col[data-action-column]': {
            w: '3.75rem'
        },
        '& col[data-stat-column]': {
            w: '9.6%'
        },
        '& col[data-total-column]': {
            w: '9.2%'
        },
        '& col[data-bonus-column]': {
            w: '33.2%'
        },
        '& col[data-slot-column]': {
            w: '5.75rem'
        },
        '& col[data-mod-column]': {
            w: '7.875rem'
        },
        '& col[data-tuning-column]': {
            w: '8.875rem'
        },
        '& col[data-fragment-stat-column]': {
            w: '7.2rem'
        }
    }
});

export const DataTableSectionRow = styled('tr', {
    base: {
        '& td': {
            p: 'var(--rose-space-sm) var(--rose-space-xs) var(--rose-space-xs)',
            bg: 'var(--rose-surface)',
            color: 'var(--rose-muted)',
            fontSize: '0.66rem',
            fontWeight: 760,
            letterSpacing: '0.08em',
            lineHeight: 1,
            textTransform: 'uppercase'
        },
        '&[data-op="true"] td': {
            color: 'var(--rose-op)'
        }
    }
});
