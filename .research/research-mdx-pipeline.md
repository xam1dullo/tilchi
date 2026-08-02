# Research: Choosing the MDX pipeline for tilchi.uz

Answers issue [#9](https://github.com/xam1dullo/tilchi/issues/9). Verified against **live npm registry data, GitHub API state, and current docs — not memory** — on 2026-08-01. This area churns; several once-standard options are confirmed dead or in flux below.

**Context the recommendation is built on:** Next.js `16.2.12` (npm `latest`, released 2026-07-25), App Router, `output: 'export'` → GitHub Pages. Turbopack is the **default bundler** for both `next dev` and `next build` since `v16.0.0` — opt-out is the `--webpack` CLI flag ([Turbopack docs, version history](https://nextjs.org/docs/app/api-reference/turbopack)). This matters: a pipeline that needs a webpack loader or `webpack()` config breaks on a default build. Single developer, committed `.mdx` files, CI rebuild, zero external scripts on the served site.

---

## TL;DR

| Candidate | Verdict | One-line reason |
|---|---|---|
| `@next/mdx` | **Runner-up** | Official, zero runtime cost, works under Turbopack + static export — but no typed frontmatter (DIY parsing + DIY types) |
| `next-mdx-remote` | **Eliminate** | **Archived 2026-02** — README: "This project is archived and is no longer supported" |
| `fumadocs-mdx` | Third | Typed frontmatter, very active — but drags in `fumadocs-core` (docs-framework core) and is ESM-only config |
| `velite` | **Recommended** | Typed zod frontmatter, build-time data, zero runtime cost, Turbopack-compatible integration, active |
| `content-collections` | Fourth | Active and solid for `.md`, but the MDX layer (`@content-collections/mdx`, mdx-bundler) is the stale 0.2.x line |
| `contentlayer` | **Eliminate** | **Confirmed abandoned** — last release 2023-06-29, maintainer's own README: "no longer maintained due to lack of funding" |

**Recommendation: velite** — details and exact install commands in the [final section](#recommendation-for-tilchiuz).

---

## Candidate 1 — `@next/mdx` (official, file-based)

**Status: first-party, most-maintained.** `@next/mdx` is versioned in lockstep with Next itself: npm `latest` is `16.2.12` (2026-07-25), the same release as the app — verified via `npm view @next/mdx version` against `https://registry.npmjs.org`. ~1.02M weekly downloads.

**How it works:** a build-time loader (`@mdx-js/loader`) that compiles `.md`/`.mdx` files into React components — as file-based pages (`app/**/page.mdx`), as imports, or as dynamic imports with `generateStaticParams` for `[slug]` routes. Docs: [Guides: MDX](https://nextjs.org/docs/app/guides/mdx) (version 16.2.12 frontmatter, last updated 2026-06-23).

**Works under `output: 'export'`?** Yes — by mechanism and community evidence. MDX compiles to JS modules at build time; the static-exports guide lists no MDX limitation and MDX is not among its [unsupported features](https://nextjs.org/docs/app/guides/static-exports#unsupported-features). Real-world static-export usage confirmed: a Next.js 16.2.3 + `@next/mdx` static publisher repo explicitly producing "pure static output" deployable to any static host ([aman-bhandari/nextjs-16-mdx-research-publisher](https://github.com/aman-bhandari/nextjs-16-mdx-research-publisher)), and a `output: "export"` blog config with `@next/mdx` ([DiDoesDigital walkthrough](https://didoesdigital.com/blog/nextjs-blog-02-add-mdx/)). **Flagging as inferred, not a docs sentence:** no official page explicitly states "@next/mdx + static export"; the mechanism is build-time-only so nothing about it needs a server.

**Turbopack (Next 16 default):** supported — the docs' Turbopack section requires plugin names as **strings** (serializable), e.g. `remarkPlugins: ['remark-gfm']`, and "upgrade to the latest `@next/mdx`" ([MDX guide, "Using Plugins with Turbopack"](https://nextjs.org/docs/app/guides/mdx)). ⚠️ Known regression: `export const metadata` in an `.mdx` page fails under **webpack** since 16.2.0 ([issue #91735](https://github.com/vercel/next.js/issues/91735), still open as of 2026-08-01; fix PR #95057 still open, PR #94983 closed unmerged). The same pattern builds fine under **Turbopack** per the issue thread — and Turbopack is the default, so this bites only if someone explicitly opts into `--webpack`. Do not opt out of Turbopack.

**Typed frontmatter: none.** The docs are explicit: "`@next/mdx` does **not** support frontmatter by default" — options listed are `remark-frontmatter`, `remark-mdx-frontmatter`, `gray-matter` ([MDX guide, "Frontmatter"](https://nextjs.org/docs/app/guides/mdx)). Nothing validates or types it. For a blog you hand-roll: fs/globby scan → gray-matter parse → hand-written TS types → `generateStaticParams` + index page. Alternative documented pattern: `export const metadata = {...}` from inside the MDX (works with Turbopack), still untyped.

**Syntax highlighting:** build-time via rehype plugins in the MDX config — the docs themselves point at `rehype-pretty-code` ([MDX guide, "Deep Dive"](https://nextjs.org/docs/app/guides/mdx)). Both `rehype-pretty-code@0.14.5` (modified 2026-07-25) and `@shikijs/rehype@4.4.1` / `shiki@4.4.1` (modified 2026-07-31) are current and active. Zero runtime JS if used at build time.

**Config added:** `pageExtensions` + `createMDX()` wrapper in `next.config` + a mandatory `mdx-components.tsx` file ("required to use `@next/mdx` with App Router and will not work without it") + frontmatter plumbing you write yourself.

**Runtime/bundle cost:** zero — compiled to static components at build. Four dev-ish deps: `@next/mdx @mdx-js/loader @mdx-js/react @types/mdx` (install line straight from the [docs](https://nextjs.org/docs/app/guides/mdx)).

## Candidate 2 — `next-mdx-remote`

**Status: DEAD — archived.** Repo `hashicorp/next-mdx-remote` has `archived: true` (GitHub API, checked 2026-08-01), and the README's first line after the banner is: "**⚠️ This project is archived and is no longer supported ⚠️**" ([repo](https://github.com/hashicorp/next-mdx-remote)). Timeline: v6.0.0 published 2026-02-12, archive notice committed 2026-02-27. It still gets ~940K weekly downloads — migration inertia, not maintenance. A community continuation exists (`next-mdx-remote-client@2.1.11`, modified 2026-05-29), but it's a fork with a small footprint.

**How it works (and why it's wrong for this site even alive):** MDX is serialized at build/serve time and **hydrated as a client component at runtime** — the original model was `getStaticProps`/`getServerSideProps` for Pages Router. Its own README now requires a Turbopack workaround pending [vercel/next.js#64525](https://github.com/vercel/next.js/issues/64525). Even ignoring the archive, this is a runtime-cost model for a static site and has been superseded by RSC-native approaches.

**Eliminated. Do not install.**

## Candidate 3 — `fumadocs-mdx`

**Status: very active.** npm `15.2.1`, modified 2026-07-30 (one day before this research); repo pushed 2026-07-30, 12.7k stars, not archived ([fuma-nama/fumadocs](https://github.com/fuma-nama/fumadocs)). ~1.03M weekly downloads. Note: the repo has active redesign/rewrite branches (`feat-satteri`, `mdx-redesign`) — churn is real.

**What it is:** "a tool to transform content into type-safe data, similar to Content Collections" ([docs](https://fumadocs.vercel.app/docs/mdx)). Content collections defined via Macro API (`defineDocs` in a lib file) or Config API (`source.config.ts`, generating `.source`). Compiles `.md`/`.mdx` at build time using the MDX compiler (`@mdx-js/mdx`), with built-in `frontmatter`, `toc`, `structuredData`, `extractedReferences` exports.

**Typed frontmatter: yes** — pass a `schema` option (zod / standard-schema) per collection ([docs, "Customize Frontmatter"](https://fumadocs.vercel.app/docs/mdx)).

**Static export + Turbopack:** static-export usage with GitHub Pages confirmed by a real-world writeup using `createMDX()` from `fumadocs-mdx/next` + `output: "export"` + `trailingSlash` ([zephinax blog](https://zephinax.com/blog/deploy-nextjs-fumadocs-github-pages)). Turbopack support is in the source: the Next plugin wires both webpack and `nextConfig.turbopack.rules` loaders ([packages/mdx/src/next/index.ts](https://github.com/fuma-nama/fumadocs/blob/main/packages/mdx/src/next/index.ts)).

**Config/cost:** installs `fumadocs-mdx fumadocs-core @types/mdx` — `fumadocs-core@^16.7.0` is a **required** peer (all other peers optional per `peerDependenciesMeta`), i.e. you take the docs-framework's core/source layer into a non-docs site. ESM-only; docs recommend `next.config.mjs` and a native Node TS resolver for `next.config.ts`. Optional new Rust compiler ("sätteri", `@fumadocs/satteri@0.3.1`) is an optional peer in 0.x.

**Verdict: works, and arguably the richest typing of the field, but it's the most framework-shaped option — built for docs sites. Third place for a plain blog.**

## Candidate 4 — `velite`

**Status: active.** npm `0.4.0`, modified 2026-06-19; repo pushed 2026-07-30, 802 stars, not archived ([zce/velite](https://github.com/zce/velite)). ~78K weekly downloads. Pre-1.0 (0.2→0.3→0.4 shipped breaking changes — pin and read changelogs on upgrade).

**What it is:** "Turns Markdown / MDX, YAML, JSON, or others into app's data layer with Zod schema." A `velite.config.ts` defines collections + zod schemas; `velite build` validates every document and generates typed data under `.velite/`. Consumption is a plain import: `import { posts } from '@/.velite'`.

**Typed frontmatter: yes, natively.** Schema is zod; missing/invalid frontmatter **fails the build** — the exact CI-time safety a solo-dev, commit-and-push blog wants. MDX is first-class via `s.mdx()` in the schema; velite compiles MDX to a code-string at build time that you render with a small documented component (`new Function(code)` + `react/jsx-runtime`) ([Using MDX](https://velite.js.org/guide/using-mdx)). Rendered as a Server Component, that executes at build → static HTML. Their `examples/nextjs` is exactly this setup ([velite examples](https://github.com/zce/velite/tree/main/examples/nextjs)).

**Static export:** yes — velite is framework-agnostic data generation; no server APIs anywhere. The docs' recommended Next.js integration is a build-time hook in `next.config.ts` (`import('velite').then(m => m.build(...))`), explicitly presented as the replacement for the old `VeliteWebpackPlugin`, which "does not function correctly when Turbopack is enabled" ([Integration with Next.js](https://velite.js.org/guide/with-nextjs)) — so the docs are current for the Next 16 Turbopack-default world.

**Syntax highlighting:** not built in; the docs' own recommendation is build-time `@shikijs/rehype` + `shiki` wired into `velite.config.ts` rehype plugins ([Code Highlighting](https://velite.js.org/guide/code-highlighting)). Build-time, zero client JS.

**Costs to be honest about:**
- One dependency name, but a heavy install tree: `velite@0.4.0` bundles `sharp@^0.34.5` (native binary), `esbuild`, `terser`, `@mdx-js/mdx` — unpacked ~1.8MB, sharp alone is tens of MB of native artifacts. The velite docs even document sharp-related build crashes on Vercel ([issue #52](https://github.com/zce/velite/issues/52#issuecomment-2016789204)) — GH Actions Ubuntu is a less exotic target, but install time goes up.
- Pre-1.0 versioning (breaking changes between minors documented in 0.3→0.4).
- The `new Function` MDX rendering is unconventional (fine for trusted, self-authored, build-time content; not a pattern to copy into client components).

**Runtime/bundle cost: zero** — data is generated pre-build; the served site ships no velite code.

## Candidate 5 — `content-collections`

**Status: alive, but split-brained.** The project was restructured into a monorepo of `@content-collections/*` packages: `@content-collections/core@0.15.2` (2026-06-16), repo `sdorra/content-collections` pushed 2026-07-30, 1.2k stars, not archived. Meanwhile the **legacy `content-collections` npm package (0.2.x) — the one most tutorials reference — last published 2025-07-10** and its README field is empty. The docs' quickstart uses the modern `@content-collections/core` + `@content-collections/next` ([quickstart](https://www.content-collections.dev/docs/quickstart/next)); they even ship an official [Contentlayer migration guide](https://github.com/sdorra/content-collections/blob/main/docs/migration/contentlayer.mdx).

**Typed frontmatter: yes** (zod schema per collection, validated at build).

**Static export + Turbopack:** compatible — the current Next adapter is not a webpack loader at all: `withContentCollections(config)` runs the builder (generating `.content-collections/generated`) and returns the config unchanged ([packages/next/src/index.ts](https://github.com/sdorra/content-collections/blob/main/packages/next/src/index.ts)), so it's bundler-agnostic. Config surface: `content-collections.ts` + tsconfig path alias + the wrapper "must be the last plugin in the chain" (it returns a Promise).

**The catch for an MDX site:** content-collections parses frontmatter + content into *data*; MDX compilation is a separate layer. The official MDX integration is `@content-collections/mdx@0.2.2` — the **stale** line (last modified 2025-03-10, built on `mdx-bundler@10`). So the data layer is active and the MDX layer is the least-maintained piece — backwards from what an MDX-first blog needs. Fine choice for a `.md`/data site; awkward for tilchi.

## Candidate 6 — `contentlayer` — ABANDONMENT CONFIRMED

**The ticket's suspicion is correct — confirmed from the maintainer's own repo:**
- npm: last release `0.3.4`, published **2023-06-29** — three years stale (`npm view contentlayer time`, registry modified timestamp 2023-06-29).
- README (main branch, fetched 2026-08-01) opens with: "**⚠️ Unfortunately Contentlayer is no longer maintained due to lack of funding.** You can find a fork of the project here" ([contentlayerdev/contentlayer](https://github.com/contentlayerdev/contentlayer)). A fork `timlrx/contentlayer2` exists (community, 0.4.5+).
- Not just stale — **broken on modern toolchains**: `contentlayer build` crashes on Node 20+ (`TypeError: The "code" argument must be of type number` — [issue #495](https://github.com/contentlayerdev/contentlayer/issues/495), reproduced on Node 20 and 22).
- Community migration writeup: "When Contentlayer was officially discontinued and archived…" ([koldex migration story](https://koldex.iki.fi/dev/contentlayer-to-content-collections-migration)) — corroborating, not the primary source; the README statement above is.

**Eliminated. Do not install. If a migration-era tutorial references it, treat the tutorial as outdated.**

---

## Comparison matrix (all verified 2026-08-01)

| Criterion | `@next/mdx` | `next-mdx-remote` | `fumadocs-mdx` | `velite` | `content-collections` | `contentlayer` |
|---|---|---|---|---|---|---|
| Latest release | 16.2.12 (2026-07-25) | 6.0.0 (2026-02-12) | 15.2.1 (2026-07-30) | 0.4.0 (2026-06-19) | core 0.15.2 (2026-06-16); legacy 0.2.1 (2025-07-10) | 0.3.4 (2023-06-29) |
| Maintained | ✅ first-party | ❌ **archived** (2026-02-27) | ✅ very active | ✅ active | ✅ core; ⚠️ mdx layer stale | ❌ **no longer maintained** (README) |
| Works under `output: 'export'` | ✅ (inferred + community) | — | ✅ (community) | ✅ | ✅ | n/a (dead) |
| Turbopack (Next 16 default) | ✅ (strings only) | ❌ (workaround req.) | ✅ (source-verified) | ✅ (docs' current path) | ✅ (prebuild, no loader) | ❌ |
| Typed frontmatter | ❌ none (DIY) | ❌ none | ✅ zod | ✅ zod | ✅ zod | ✅ (was its selling point) |
| Syntax highlight cost | build-time (rehype) | runtime hydrate | build-time | build-time (`@shikijs/rehype`) | build-time | build-time |
| Config added | pageExtensions + wrapper + mandatory `mdx-components.tsx` + DIY frontmatter | serialize/hydrate plumbing | next config + collection defs + fumadocs-core loader | one `velite.config.ts` + next.config hook | `content-collections.ts` + tsconfig alias + wrapper | config DSL + CLI |
| Deps installed | 4 small official | 1 (dead) | fumadocs-mdx + fumadocs-core + types | velite (heavy: sharp/esbuild/terser) | core + next adapter + zod (+ stale mdx pkg) | 1 (dead) |
| Runtime/bundle cost | zero | client hydration | zero | zero | zero | zero |
| Weekly downloads | ~1.02M | ~940K | ~1.03M | ~78K | ~2.4K (legacy) | ~21K |

---

## Recommendation for tilchi.uz

**Use `velite`** — typed, build-time-validated content with MDX support, for one config file and one dependency, under a Turbopack-default static export. It's the only candidate that is simultaneously: actively maintained, static-export-safe, Turbopack-safe, typed-frontmatter-first, and lean in *configuration* — at the cost of a heavier npm install and pre-1.0 versioning.

### What it costs

- **Dependencies:** `velite` (pulls `sharp`, `esbuild`, `terser`, `@mdx-js/mdx` — heavy install, zero runtime) + `shiki`/`@shikijs/rehype` for highlighting. Total: 3 names. Compare: `@next/mdx` is 4 names but no typed frontmatter; `content-collections` needs its stale mdx layer; `fumadocs-mdx` needs the fumadocs-core docs-framework core.
- **Config:** one `velite.config.ts` at repo root (collections, zod schemas, rehype plugin), one import in `next.config.ts` (Turbopack-compatible build hook — do **not** use `VeliteWebpackPlugin`, it dies under Turbopack), one `@/.velite` path alias for tsconfig. `.velite/` goes to `.gitignore`.
- **Build/runtime tradeoff:** all content processing happens pre-build in CI; the served site is pure static HTML with zero velite JS and zero client-side syntax highlighting (shiki emits styled HTML at build). The one unconventional piece is rendering MDX via velite's documented `new Function(code)` component — acceptable for self-authored, trusted content, rendered server-side at build time.

### Exact install commands

```bash
npm install velite shiki @shikijs/rehype
```

Then per [velite's Next.js guide](https://velite.js.org/guide/with-nextjs) and [MDX guide](https://velite.js.org/guide/using-mdx): add the build hook to `next.config.ts`, define the `posts` collection with `s.mdx()`, wire `@shikijs/rehype` into `velite.config.ts` rehype plugins, and import `{ posts } from '@/.velite'` for the index page, post pages (`generateStaticParams` from the collection — no fs globbing, no gray-matter), and `generateMetadata`.

### Runner-up

**`@next/mdx`** — the zero-architecture official option. Choose it instead if typed frontmatter is judged not worth one dependency: same static-export story, guaranteed version alignment with Next, but you then write and maintain the frontmatter parse + types + index-scan plumbing yourself (docs point at `remark-frontmatter`/`gray-matter`), and you must keep the Turbopack string-plugin convention and avoid the open webpack `export const metadata` regression (i.e., never opt into `--webpack`).

---

## Explicit gaps (could not confirm, flagging rather than guessing)

- **`@next/mdx` + `output: 'export'`**: no official docs sentence states the combination is supported; inferred from build-time mechanism + community static-export sites. Medium-high confidence, not primary-source confirmed.
- **`@next/mdx` webpack metadata regression scope**: issue #91735 open and PR #95057 open as of 2026-08-01; I did not determine whether any 16.2.x patch release partially mitigates webpack, nor audit the fixes' contents.
- **fumadocs-mdx under Turbopack**: Turbopack loader rules exist in source and community static-export usage exists, but I did not run a real Turbopack + `output: 'export'` build; also did not assess the in-flight `satteri`/`mdx-redesign` direction's impact on API stability.
- **velite 0.4.0's `s.mdx()` rendering under static export**: the `new Function` render executes at build time only when the component is a Server Component; I did not build-test this on 16.2.12. If the post body ever ends up in a client component, that pattern must change (it would shift to runtime eval in the browser).
- **GitHub Actions install/build time with velite**: sharp's native binaries on the runner are standard Ubuntu wheels, but I did not measure the actual install+first-build delta.
