# Domain and architecture context (Tilchi)

This document defines the core domain concepts, Ubiquitous Language, and architectural boundaries (Seams) for the Tilchi project.

## Ubiquitous language and core modules

### 1. Domain content modules
- **Single Source of Truth.** Core business domain content (FAQs, course/program features, pricing structures) must live in immutable, deep data modules.
- **`src/lib/domain/` (Section Content Modules).** Immutable domain data, split by concern: `faqs.ts` (FAQ pairs `q`/`a`), `programs.ts` (program offerings *Bolalar*, *IELTS*, *Kattalar* with `ProgramIconId`), `demo.ts` (demo steps), `method.ts` (method steps), and `trust.ts` (trust items). The UI presentation layer (`components/sections/`) and the SEO structured data generator (`lib/seo.ts`, FAQPage schema) both consume this data, with no duplicated copy.
- **`src/lib/site.ts` (Site Config Module).** Organizational parameters, teacher profile data (*Mukhtasar Karimjonova*), credentials (IELTS 7.0, C1), pricing schedules (stored, not displayed; the UI shows "kelishuv asosida"), and the bot link generator. The teacher has never obtained CELTA, so do not add it back. `botLink(seg, lv)` returns a Telegram deep link with a `?start=` payload.
- **`content/posts/*.mdx` (Blog Module).** Immutable article sources. Velite compiles them into `.velite/posts.json`. MDX `run()` renders them at build time.

### 2. Architectural seams and locality
- **Source Seam.** Application source (`src/app/`, `src/components/`, `src/lib/`) sits under `src/`, decoupled from root infrastructure configuration (`next.config.ts`, `velite.config.ts`, `vitest.config.ts`, `package.json`), static assets (`public/`), and velite content (`content/`). Aliases are configured in `tsconfig.json` and `vitest.config.ts`: `@/*` maps to `./src/*`, and `@velite/*` maps to `./.velite/*`.
- **SEO Adapter (`src/lib/seo.ts`).** It is a pure translation adapter. It consumes domain data objects (`src/lib/site.ts`, `src/lib/domain/*`) and generates Schema.org JSON-LD graphs without hardcoded business strings or duplicated figures.
- **Presentation Seam.** UI components in `src/components/sections/` take text and invariants from data modules. They keep exclusive ownership of DOM structure, GSAP animation wrappers, and interactive state. Data modules are pure TypeScript. They must never import React or contain JSX or DOM elements. Visual presentation stays in UI components, mapped through icon adapter maps. For example, the `ProgramIconId` key `'kids'` maps to an SVG element in `src/components/sections/Programs.tsx`.

### 3. Verification and testing surface
- **Drift-Free Assurance.** Vitest suites cover SEO adaptations and data logic (`src/lib/posts.test.ts`, `src/lib/site.test.ts`, `src/lib/seo.test.ts`). They check draft filtering, date formatting, price formatting, and bot link payload sanitization, so code and data cannot diverge silently.
- **Build gates.** `scripts/check-js-budget.mjs` enforces a 280 KB gzip JS ceiling and bans animation JS on article pages. `scripts/check-contrast.mjs` checks WCAG AA color pairs. Both run in CI and locally.
- **Styles.** Design tokens and shared primitives live in `src/app/globals.css` (`:root` is parsed by `check-contrast`). Per-section CSS lives in `src/styles/<section>.css`, `@import`-ed at the top of `globals.css`; Tailwind v4 inlines partials *before* the base rules, so partials use class-led selectors only. The visual spec is `design.md`.
