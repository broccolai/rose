# Development

Rose is a Bun workspace. The root package owns the SolidStart application and coordinates focused packages under `packages/`.

## Workspace layout

| Package | Responsibility |
| --- | --- |
| `@rose/armor-domain` | Pure TypeScript Armor 3.0 domain data |
| `@rose/armor-engine` | Rust armor solver and its Wasm binding |
| `@rose/armor-bench` | Loaded-vault solver benchmarks |
| `@rose/weapon-engine` | Vendored and extended Rust weapon oracle |
| `@rose/weapon-model` | Shared weapon catalog, selection, calculation, and Oracle adapter API |
| `@rose/weapon-catalog` | Bungie manifest compaction and engine coverage audit |

Each package owns its specialist commands. Root scripts only run the app or coordinate package lifecycles through Bun workspace filters.

## Everyday commands

```sh
bun install
bun run dev
bun run check
bun run lint
bun run test
bun run build
```

`bun run verify` runs the type check, all linters, TypeScript and Rust tests, and the production build.

## Generated assets

Both Wasm bindings and the compact weapon catalog are generated artifacts:

```sh
bun run generate:wasm
bun run generate:catalog
bun run audit:weapons
```

Panda's `prepare` hook generates its typed `.panda` API after dependency installation. Its PostCSS plugin extracts application CSS during normal development and production builds, so there is no separate CSS-generation command or checked-in generated stylesheet.

Wasm and catalog outputs are checked in so production deployment only needs Bun. Each engine owns and exports its generated Wasm module from its package; app and tooling code should never import a generated file through `src/`. Regenerate the outputs when their Rust source or Bungie manifest input changes; an ordinary web build does not rebuild either artifact.

Both Rust packages pin their own toolchain. `scripts/run-rust.ts` only ensures subprocesses such as wasm-pack resolve that pinned rustup toolchain before any system Rust installation.

## Package commands

Use a workspace filter when working on one package:

```sh
bun run --filter @rose/armor-engine test
bun run --filter @rose/weapon-engine build
bun run --filter @rose/weapon-catalog audit
bun run --filter @rose/armor-bench bench:sliders
```

## Deployment

Rose is a static SolidStart application. Cloudflare Pages should use:

| Setting | Value |
| --- | --- |
| Build command | `bun run build` |
| Build output directory | `.output/public` |

Git-integrated Pages deployments do not need a repository deploy script or Wrangler dependency. `public/_redirects` provides the SPA fallback for direct visits to routes such as the Bungie OAuth callback, while `public/_headers` owns cache policy.
