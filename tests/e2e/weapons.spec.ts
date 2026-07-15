import { expect, type Page, test } from '@playwright/test';

async function openWeapons(page: Page) {
    await page.goto('/weapons');
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    await expect(page.getByText('Optimal', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pin for comparison' })).toBeEnabled();
}

async function setNumber(page: Page, name: string, value: number) {
    const input = page.getByRole('spinbutton', { name });
    await input.fill(String(value));
    await input.press('Tab');
    await expect(input).toHaveValue(String(value));
}

test('builds, shares, restores, and compares complete weapon scenarios', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://127.0.0.1:5173' });
    await openWeapons(page);

    await expect(page.getByText('Body', { exact: true }).locator('..').locator('strong')).toHaveText('2.17s');
    await expect(page.locator('[data-stat="Impact"]')).toContainText('84');

    const rapidHit = page.getByRole('slider', { name: 'Rapid Hit stacks' });
    await expect(rapidHit).toBeVisible();
    await rapidHit.focus();
    await rapidHit.press('ArrowRight');
    await expect(rapidHit).toBeFocused();
    await expect(rapidHit).toHaveValue('1');
    await expect(page).toHaveURL(/e=247725512%3A1/);

    await setNumber(page, 'Target health value', 275);
    await setNumber(page, 'Overshield value', 15);
    await setNumber(page, 'Weapons stat value', 150);
    await page.getByRole('button', { name: 'PvE' }).click();
    await expect(page.getByRole('heading', { name: 'Damage' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Target health value' })).toHaveCount(0);
    await expect(page).toHaveURL(/m=pve/);
    await expect(page).toHaveURL(/hp=275/);
    await expect(page).toHaveURL(/os=15/);
    await expect(page).toHaveURL(/ws=150/);

    await page.getByRole('button', { name: 'Copy share link' }).click();
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    const sharedParams = new URL(sharedUrl).searchParams;
    expect(sharedParams.get('e')).toContain('247725512:1');
    expect(sharedParams.get('m')).toBe('pve');
    expect(sharedParams.get('hp')).toBe('275');
    expect(sharedParams.get('os')).toBe('15');
    expect(sharedParams.get('ws')).toBe('150');

    await page.goto(sharedUrl);
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Rapid Hit stacks' })).toHaveValue('1');
    await page.getByRole('button', { name: 'PvP' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Target health value' })).toHaveValue('275');
    await expect(page.getByRole('spinbutton', { name: 'Overshield value' })).toHaveValue('15');
    await expect(page.getByRole('spinbutton', { name: 'Weapons stat value' })).toHaveValue('150');

    await expect(page.getByRole('button', { name: 'Pin for comparison' })).toBeEnabled();
    await page.getByRole('button', { name: 'Pin for comparison' }).click();
    await page.getByRole('searchbox', { name: 'Search weapons' }).fill('Austringer');
    await page
        .getByRole('button', { name: /Austringer/ })
        .first()
        .click();
    await expect(page.getByRole('heading', { name: 'Austringer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pin for comparison' })).toBeEnabled();
    await page.getByRole('button', { name: 'Pin for comparison' }).click();

    const matrix = page.getByRole('table', { name: /Pinned roll metric comparison/ });
    await expect(matrix).toBeVisible();
    await expect(matrix.getByRole('columnheader', { name: 'Rose' })).toBeVisible();
    await expect(matrix.getByRole('columnheader', { name: 'Austringer' })).toBeVisible();
    await expect(matrix.getByRole('rowheader', { name: 'Optimal TTK' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Load Rose comparison roll' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load Austringer comparison roll' })).toBeVisible();
    await page.getByRole('button', { name: 'Load Rose comparison roll' }).click();
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Target health value' })).toHaveValue('275');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
});

test('recovers from a failed catalog request', async ({ page }) => {
    let requests = 0;
    await page.route('**/data/weapon-catalog.json', async (route) => {
        requests += 1;
        if (requests === 1) {
            await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporary"}' });
            return;
        }
        await route.continue();
    });

    await page.goto('/weapons');
    await expect(page.getByRole('alert').first()).toContainText(/catalog|503|load/i);
    await page.getByRole('button', { name: 'Retry' }).first().click();
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    expect(requests).toBe(2);
});
