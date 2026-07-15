const vinxiEntry = new URL(import.meta.resolve('vinxi'));
const [{ createBuild }, { loadApp }] = await Promise.all([
    import(new URL('./build.js', vinxiEntry)),
    import(new URL('./load-app.js', vinxiEntry))
]);

try {
    globalThis.MANIFEST = {};
    const app = await loadApp(undefined, { mode: undefined });
    if (!app) throw new Error("Couldn't load app");

    process.env.NODE_ENV = 'production';
    await createBuild(app, { mode: undefined, preset: undefined, router: undefined }, undefined);

    // Vinxi leaves its esbuild service open when driven through Node 26.
    process.exit(0);
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}
