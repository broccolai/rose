import { styled } from '@panda/jsx';
import { A } from '@solidjs/router';
import Crosshair from 'lucide-solid/icons/crosshair';
import Shield from 'lucide-solid/icons/shield';

type ProductNavProps = {
    active: 'armor' | 'weapons';
    onNavigate?: (destination: 'armor' | 'weapons', event: MouseEvent) => void;
};

const Nav = styled('nav', {
    base: {
        display: 'inline-grid',
        gridTemplateColumns: 'repeat(2, max-content)',
        gap: '2px',
        justifySelf: 'start',
        p: '2px',
        border: '1px solid var(--rose-border)',
        borderRadius: 'var(--rose-radius-sm)',
        bg: 'var(--rose-surface-soft)'
    }
});

const NavLink = styled(A, {
    base: {
        display: 'inline-grid',
        gridTemplateColumns: '0.85rem auto',
        alignItems: 'center',
        gap: '0.35rem',
        minH: '1.65rem',
        px: '0.55rem',
        borderRadius: 'var(--rose-radius-xs)',
        color: 'var(--rose-muted)',
        fontSize: '0.68rem',
        fontWeight: 750,
        lineHeight: 1,
        textDecoration: 'none',
        transition: 'background-color 120ms ease, color 120ms ease',
        _hover: {
            color: 'var(--rose-text)',
            bg: 'var(--rose-surface-raised)'
        },
        _focusVisible: {
            outline: '2px solid color-mix(in srgb, var(--rose-accent) 40%, transparent)',
            outlineOffset: '1px'
        },
        '&[aria-current="page"]': {
            color: 'var(--rose-text)',
            bg: 'var(--rose-surface-raised)',
            boxShadow: 'inset 0 -2px 0 var(--rose-accent)'
        },
        '& svg': {
            w: '0.85rem',
            h: '0.85rem',
            strokeWidth: 2
        }
    }
});

export function ProductNav(props: ProductNavProps) {
    return (
        <Nav aria-label="Rose tools">
            <NavLink
                href="/"
                aria-current={props.active === 'armor' ? 'page' : undefined}
                onClick={(event) => props.onNavigate?.('armor', event)}
            >
                <Shield aria-hidden="true" />
                Armor
            </NavLink>
            <NavLink
                href="/weapons"
                aria-current={props.active === 'weapons' ? 'page' : undefined}
                onClick={(event) => props.onNavigate?.('weapons', event)}
            >
                <Crosshair aria-hidden="true" />
                Weapons
            </NavLink>
        </Nav>
    );
}
