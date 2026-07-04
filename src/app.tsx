import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';

import '@/app/styles/panda.css';
import '@/app/styles/global.css';

export default function App() {
    return (
        <Router root={(props) => <Suspense>{props.children}</Suspense>}>
            <FileRoutes />
        </Router>
    );
}
