# TypeScript And Solid Modernization

This pass keeps rose on current packages and moves the project toward stricter, more future-proof TypeScript without flipping every painful strictness switch at once.

## Package Posture

Updated to current latest versions reported by `bun outdated`:

- TypeScript 6
- Vite 8
- Solid 1.9 latest
- Solid Router 0.16 latest
- SolidStart 1.x latest
- Panda CSS and Biome latest
- Node types latest

SolidStart latest no longer exposes the old Vite plugin used by this project. The app now uses `app.config.ts`, SolidStart's current config entrypoint, with the existing Vite options nested under the `vite` key.

## TypeScript Config

Enabled now:

- `target: "ESNext"`
- `lib: ["ESNext", "DOM", "DOM.Iterable"]`
- `moduleDetection: "force"`
- `noUncheckedSideEffectImports: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`
- `noPropertyAccessFromIndexSignature: true`
- `erasableSyntaxOnly: true`

Removed:

- `baseUrl`, because TypeScript 6 reports it as deprecated on the path to TypeScript 7. The `paths` targets now use explicit `./` prefixes.

Not enabled yet:

- `noUncheckedIndexedAccess`

`exactOptionalPropertyTypes` is now enabled. The codebase now distinguishes optional fields from present fields whose value can be `undefined`, which made these shapes more honest:

- optional object properties being assigned explicit `undefined`
- optional function props passed through as present-but-undefined
- fetch/request options including `body: undefined`

`noUncheckedIndexedAccess` is still worth doing, but it is a real code-quality project. A trial run exposed many tuple and array index assumptions in the solver and benchmark code. That should be cleaned in a focused pass, starting with `packages/armor-calc` because that is where the indexing assumptions matter most.

## Solid Style

Recommended rose convention:

- Use arrow functions for app/components/helpers by default when adding new code.
- Keep named function declarations where they improve stack traces, route default exports, overloads, hoisting clarity, or long pure solver sections.
- Do not mass-convert old function declarations. There are hundreds, and the churn is not worth it.
- Do not destructure reactive props directly in Solid components. Prefer `props.foo`, accessor helpers like `const name = () => props.name`, or `splitProps` when forwarding groups.
- Prefer `createMemo` for derived values and expensive transforms.
- Keep `createEffect` for side effects: persistence, subscriptions, network/worker requests, DOM integration, and external state.
- Keep memo callbacks pure. If a memo wants to set a signal, it is probably an effect or a model helper.
- Use stores for nested mutable UI state only when the state shape benefits from fine-grained property updates. For small scalar state, signals are clearer.

## Build System

The project now builds through Vinxi/SolidStart:

- `bun run dev` -> `vinxi dev`
- `bun run build` -> `vinxi build`
- `bun run preview` -> `vinxi start`

Static deploys should publish `.output/public`. Cloudflare's SPA fallback lives in `public/_redirects`, which lets `/auth/bungie/callback` serve the app shell without a post-build copy step.

## Follow-Up Strictness Order

1. Enable `noUncheckedIndexedAccess` in solver internals after tuple/index helper cleanup.
2. Add Valibot schemas for persisted/debug JSON boundaries before making cached data assumptions stricter.
3. Consider `noFallthroughCasesInSwitch` and `noImplicitOverride` if code shapes start using switches/classes more heavily.
