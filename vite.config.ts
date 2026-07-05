import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { solidStart } from '@solidjs/start/config';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const useDevHttps = process.env.ROSE_DEV_HTTPS !== '0';
const localCertFile = fileURLToPath(new URL('./.cert/localhost.pem', import.meta.url));
const localKeyFile = fileURLToPath(new URL('./.cert/localhost-key.pem', import.meta.url));
const localHttps =
    useDevHttps && existsSync(localCertFile) && existsSync(localKeyFile)
        ? {
              cert: readFileSync(localCertFile),
              key: readFileSync(localKeyFile)
          }
        : undefined;

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
        port: 5173,
        https: localHttps
    },
    plugins: [...(useDevHttps && !localHttps ? [basicSsl()] : []), ...solidStart({ ssr: false })]
});
