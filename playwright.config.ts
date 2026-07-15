import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: './test-results',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    reporter: 'line',
    use: {
        baseURL: 'https://127.0.0.1:5173',
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure'
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
    ],
    webServer: {
        command: 'bun x --bun vinxi dev --host 127.0.0.1 --port 5173',
        url: 'https://127.0.0.1:5173',
        ignoreHTTPSErrors: true,
        reuseExistingServer: true,
        timeout: 60_000
    }
});
