# Domain & Architecture Context (Tilchi)

This document defines the core domain concepts, Ubiquitous Language, and architectural boundaries (Seams) for the Tilchi project.

## Ubiquitous Language & Core Modules

### 1. Domain Content Modules
- **Single Source of Truth**: Core business domain content (FAQs, course/program features, pricing structures) must reside in immutable, deep data modules.
- **`content/sections.ts` (Section Content Module)**: Defines the structured FAQ pairs (`q`, `a`), program offerings (*Bolalar*, *IELTS*, *Kattalar*), demo steps, method steps, and trust items. Consumed simultaneously by the UI presentation layer (`components/sections/`) and the SEO structured data generator (`lib/seo.ts` FAQPage schema) — no duplicated copy.
- **`lib/site.ts` (Site Config Module)**: Organizational parameters, teacher profile data (*Mukhtasar Karimjonova*), certifications (CELTA, IELTS 7.0, C1), pricing schedules, and Bot link generator (`botLink(seg, lv)` → Telegram deep link with `?start=` payload).
- **`content/posts/*.mdx` (Blog Module)**: Immutable article sources compiled by velite into `.velite/posts.json`; rendered via MDX `run()` at build time.

### 2. Architectural Seams & Locality
- **Source Seam**: Application source (`app/`, `components/`, `lib/`, `content/`) sits at the project root, decoupled from root infrastructure configuration (`next.config.ts`, `velite.config.ts`, `vitest.config.ts`, `package.json`) and static assets (`public/`). Matches the canonical velite + Next.js example structure; `src/` is optional and was deliberately not used (no benefit, alias churn).
- **SEO Adapter (`lib/seo.ts`)**: Pure translation adapter. Consumes domain data objects (`lib/site.ts`, `content/sections.ts`) and generates Schema.org JSON-LD graphs without hardcoded business strings or duplicated figures.
- **Presentation Seam**: UI components (`components/sections/`) ingest data modules for text and invariants while retaining exclusive ownership of DOM structure, GSAP animation wrappers, and interactive state. Data modules are pure TypeScript and must NEVER import React or contain JSX/DOM elements; visual presentation is handled by UI components via Icon Adapter maps (e.g., `ProgramIcon` enum keys like `'bolalar'` → SVG elements in `components/sections/Programs.tsx`).

### 3. Verification & Testing Surface
- **Drift-Free Assurance**: SEO adaptations and data logic are covered by Vitest suites (`lib/posts.test.ts`, `lib/site.test.ts`). Tests verify draft filtering, date formatting, price formatting, and bot-link payload sanitization without silent divergence.
- **Build gates**: `scripts/check-js-budget.mjs` (280 KB gzip JS ceiling, no animation JS on article pages) and `scripts/check-contrast.mjs` (WCAG AA pairs) run in CI/local.
