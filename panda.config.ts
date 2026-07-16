import { defineConfig } from '@pandacss/dev';

export default defineConfig({
    preflight: false,
    jsxFramework: 'solid',
    include: ['./src/**/*.{ts,tsx}'],
    exclude: [],
    outdir: '.panda',
    importMap: '@panda',
    hash: true
});
