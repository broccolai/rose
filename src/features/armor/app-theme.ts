export const APP_THEMES = ['void', 'dim', 'light', 'burger'] as const;
export const VISIBLE_APP_THEMES = ['void', 'dim', 'light'] as const satisfies readonly AppTheme[];

export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_APP_THEME: AppTheme = 'void';

export const APP_THEME_LABELS = {
    void: 'Void',
    dim: 'Dim',
    light: 'Light',
    burger: 'Burger'
} as const satisfies Record<AppTheme, string>;

export function isAppTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && (APP_THEMES as readonly string[]).includes(value);
}

export function sanitizeAppTheme(value: unknown): AppTheme {
    return isAppTheme(value) ? value : DEFAULT_APP_THEME;
}
