import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { solidStart } from '@solidjs/start/config';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';

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
const privateDataDir = fileURLToPath(new URL('./data/private', import.meta.url));

function latestLocalTestDataPath() {
    if (!existsSync(privateDataDir)) {
        return null;
    }

    const candidates = readdirSync(privateDataDir)
        .filter((candidate) => candidate.endsWith('.json'))
        .sort();
    const file =
        candidates.filter((candidate) => candidate.startsWith('rose-debug-vault-export-')).at(-1) ??
        candidates.filter((candidate) => candidate.startsWith('rose-loaded-benchmark-bundle-')).at(-1);

    return file ? fileURLToPath(new URL(`./data/private/${file}`, import.meta.url)) : null;
}

function roseDevTestDataPlugin(): Plugin {
    return {
        name: 'rose-dev-test-data',
        configureServer(server) {
            server.middlewares.use('/__rose-test-data__/loaded-benchmark-bundle', (_request, response) => {
                const bundlePath = latestLocalTestDataPath();

                if (!bundlePath) {
                    response.statusCode = 404;
                    response.end('No rose local test data found.');
                    return;
                }

                response.setHeader('content-type', 'application/json; charset=utf-8');
                response.end(readFileSync(bundlePath, 'utf8'));
            });
        }
    };
}

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
    plugins: [roseDevTestDataPlugin(), ...(useDevHttps && !localHttps ? [basicSsl()] : []), ...solidStart({ ssr: false })]
});
