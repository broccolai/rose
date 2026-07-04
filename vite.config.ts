import { fileURLToPath, URL } from 'node:url';
import { solidStart } from '@solidjs/start/config';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@armor-calc': fileURLToPath(new URL('./packages/armor-calc/src/index.ts', import.meta.url)),
            '@panda': fileURLToPath(new URL('./.panda', import.meta.url))
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5173
    },
    plugins: [basicSsl(), ...solidStart({ ssr: false })]
});
