import { defineConfig } from '@pandacss/dev';

export default defineConfig({
    preflight: false,
    jsxFramework: 'solid',
    include: ['./src/**/*.{ts,tsx}'],
    exclude: [],
    outdir: '.panda',
    importMap: '@panda',
    hash: true,
    theme: {
        extend: {
            tokens: {
                colors: {
                    ink: { value: '#16181d' },
                    paper: { value: '#f7f5ef' },
                    line: { value: '#d6d0c4' },
                    panel: { value: '#ffffff' },
                    accent: { value: '#2f6fed' },
                    danger: { value: '#b42318' },
                    muted: { value: '#626a76' }
                }
            }
        }
    }
});
