import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const themes = ['void', 'dim', 'light', 'burger'] as const;

test('has no automated accessibility, console, or layout failures in every theme', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/weapons');
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    await expect(page.getByText('Optimal', { exact: true })).toBeVisible();

    for (const theme of themes) {
        await page.evaluate((value) => {
            document.documentElement.dataset['theme'] = value;
        }, theme);
        await page.waitForTimeout(20);

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        expect(results.violations, `${theme} theme accessibility violations`).toEqual([]);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
            `${theme} theme horizontal overflow`
        ).toBeLessThanOrEqual(1);
    }

    await page.evaluate(() => {
        document.documentElement.dataset['theme'] = 'light';
    });
    await expect(page.locator('.weapon-plug-button').first()).toHaveCSS('background-color', 'rgb(36, 38, 45)');
    expect(errors).toEqual([]);
});

test('supports roving keyboard selection', async ({ page }) => {
    await page.goto('/weapons');
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();

    const rows = page.locator('[data-weapon-row="true"]');
    expect(await rows.evaluateAll((elements) => elements.filter((element) => element.getAttribute('tabindex') === '0').length)).toBe(1);
    await rows.first().focus();
    await rows.first().press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();

    const barrel = page.getByRole('radiogroup', { name: 'Barrel perks' });
    const magazine = page.getByRole('radiogroup', { name: 'Magazine perks' });
    await expect(barrel).toHaveAttribute('aria-orientation', 'vertical');
    const barrelFirstBox = await barrel.getByRole('radio').first().boundingBox();
    const barrelSecondBox = await barrel.getByRole('radio').nth(1).boundingBox();
    const magazineFirstBox = await magazine.getByRole('radio').first().boundingBox();
    expect(barrelSecondBox?.y).toBeGreaterThan(barrelFirstBox?.y ?? Number.POSITIVE_INFINITY);
    expect(magazineFirstBox?.x).toBeGreaterThan(barrelFirstBox?.x ?? Number.POSITIVE_INFINITY);

    const selectedPlug = barrel.getByRole('radio', { checked: true });
    const selectedIndex = await selectedPlug.evaluate((element) => [...(element.parentElement?.children ?? [])].indexOf(element));
    const nextPlug = barrel.getByRole('radio').nth(selectedIndex + 1);
    await selectedPlug.focus();
    await selectedPlug.press('ArrowRight');
    await expect(nextPlug).toBeFocused();
    await expect(nextPlug).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Upgrades' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Mod 1 perks' })).toHaveAttribute('aria-orientation', 'horizontal');
});

test('supports qualified search and global focus shortcuts', async ({ page }) => {
    await page.goto('/weapons');
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();

    await page.locator('#weapon-analysis').focus();
    await page.keyboard.press('Shift+K');
    const search = page.getByRole('searchbox', { name: 'Search weapons' });
    await expect(search).toBeFocused();

    await search.fill('name:austringer is:craftable source:leviathan');
    await expect(page.getByText('1 weapon', { exact: true })).toBeVisible();
    await expect(page.locator('[data-weapon-row="true"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Austringer/ })).toBeVisible();

    await search.fill('source:grandmaster is:adept weapon:handcannon');
    await expect(page.getByRole('button', { name: /The Palindrome \(Adept\)/ }).first()).toBeVisible();

    await search.fill('name:rose perk:"rapid hit"');
    await expect(page.getByRole('button', { name: /Rose/ }).first()).toBeVisible();
});

test('fits a 320px viewport and preserves theme across tool navigation', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/weapons');
    await expect(page.getByRole('heading', { name: 'Rose' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('searchbox', { name: 'Search weapons' }).fill('Austringer');
    await page
        .getByRole('button', { name: /Austringer/ })
        .first()
        .click();
    await expect(page.locator('#weapon-editor')).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Austringer' })).toBeVisible();

    await page.getByRole('button', { name: /Theme: Void.*Switch to Dim/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');
    await page.getByRole('link', { name: 'Armor' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /ARMOR/ })).toBeVisible();
    await page.getByRole('link', { name: 'Weapons' }).click();
    await expect(page).toHaveURL(/\/weapons/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');

    await page.getByRole('button', { name: 'PvE' }).click();
    await expect(page.getByRole('heading', { name: 'Damage' })).toBeVisible();
    await expect(page.getByText('PvE profile')).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Target health value' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
