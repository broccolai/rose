import { styled } from '@panda/jsx';
import { createSignal, onMount } from 'solid-js';

import { exchangeAuthorizationCode, takeStoredOAuthState } from '@/features/bungie/oauth';

const Page = styled('main', {
    base: {
        minH: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: '20px'
    }
});

const Panel = styled('section', {
    base: {
        w: 'min(560px, 100%)',
        p: '24px',
        bg: 'panel',
        border: '1px solid token(colors.line)',
        borderRadius: '8px',
        boxShadow: '0 20px 50px rgba(22, 24, 29, 0.08)'
    }
});

const Text = styled('p', {
    base: {
        m: 0,
        color: 'muted',
        lineHeight: 1.6
    }
});

export default function BungieCallback() {
    const [message, setMessage] = createSignal('Completing Bungie sign-in...');

    onMount(async () => {
        const url = new URL(window.location.href);
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const expectedState = takeStoredOAuthState();

        if (error) {
            setMessage(`Bungie returned an OAuth error: ${error}`);
            return;
        }

        if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
            setMessage('OAuth state validation failed. No token was stored.');
            return;
        }

        try {
            await exchangeAuthorizationCode(code);
            setMessage('Signed in. Returning to vault export...');
            window.location.replace('/');
        } catch (exchangeError) {
            setMessage(exchangeError instanceof Error ? exchangeError.message : 'Token exchange failed.');
        }
    });

    return (
        <Page>
            <Panel>
                <Text>{message()}</Text>
            </Panel>
        </Page>
    );
}
