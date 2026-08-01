# Research: Next.js static export on GitHub Pages (apex domain tilchi.uz)

Answers issue [#4](https://github.com/xam1dullo/tilchi/issues/4). Verified against **live docs and source, not memory** — see citations per claim.

**Findings apply to Next.js `16.2.12`** (npm `latest` dist-tag, released 2026-07-25 — confirmed directly against `https://registry.npmjs.org/next`). The static-exports guide itself was last updated 2026-07-22, i.e. current for this release.

---

## TL;DR — `next.config.ts` for this project

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // no image CDN in this stack; see Q1
  },
  trailingSlash: true, // see Q3 — optional on GH Pages specifically, but zero downside
  // basePath: not set — apex custom domain serves from the site root, see Q3
}

export default nextConfig
```

No `rewrites`/`redirects`/`headers`/`i18n`/server actions/middleware in this config — all unsupported under `output: 'export'` (Q6). `.nojekyll` is not needed for this repo's deployment pipeline (Q5). The `CNAME` file at repo root becomes inert once you're on the current workflow architecture (see Workflow section) — no action needed to preserve it.

---

## Q1 — `next/image`: is `unoptimized: true` still required?

Yes, functionally — with one alternative. As of 16.2.12, `output: 'export'` supports exactly two `images` configurations, and the default (server-based) optimizer is not one of them:

- **`images.unoptimized: true`** — serves the original file as-is, no `/_next/image` proxy, no server required. Config-level form has been stable since Next.js 12.3.0. ([Image component docs, "unoptimized"](https://nextjs.org/docs/app/api-reference/components/image#unoptimized))
- **Custom loader** (`images.loader: 'custom'` + `images.loaderFile`) — points at a function that builds a URL for a *third-party* image service (Cloudinary, etc. — the docs' own example is Cloudinary). This still requires optimization to happen somewhere with a running server; there is no built-in "static/local" optimizing loader for export. ([Static exports guide, "Image Optimization"](https://nextjs.org/docs/app/guides/static-exports#image-optimization); [Image docs, "loaderFile"](https://nextjs.org/docs/app/api-reference/components/image#loaderfile))

If you configure neither, `next build` throws at build time (loud, not silent) — confirmed directly in current source:

```ts
// packages/next/src/export/index.ts (canary, current)
if (config.output === 'export' && isDefaultLoader && !unoptimized) {
  throw new Error(
    `Image Optimization using the default loader is not compatible with \`{ output: 'export' }\`.`
  )
}
```
([source](https://github.com/vercel/next.js/blob/canary/packages/next/src/export/index.ts))

**Recommendation for tilchi.uz**: `unoptimized: true`. The current `index.html` has no `<img>` usage at all today (grepped — only an inline SVG noise texture and a planned `og.png`), so there's no volume of images to justify standing up a third-party image-optimization account. If image count grows meaningfully later, revisit the custom-loader path then.

---

## Q2 — `next/font`: works under export, and self-hosts?

Yes to both, and this is exactly what removes the two render-blocking Google Fonts requests (Fraunces + Inter) in the current `index.html`.

- Self-hosting is confirmed directly: **"CSS and font files are downloaded at build time and self-hosted with the rest of your static assets. No requests are sent to Google by the browser."** ([Font component docs](https://nextjs.org/docs/app/api-reference/components/font))
- Compatibility with `output: 'export'`: `next/font` is not listed in either the Supported or Unsupported Features sections of the static-exports guide ([static-exports guide](https://nextjs.org/docs/app/guides/static-exports#unsupported-features)). I could not find a sentence in the docs that explicitly says "next/font is compatible with static export" — **flagging this as inferred, not directly confirmed**: the mechanism runs entirely at build time (downloads files, writes them into the static asset output, injects `<link>`/CSS referencing the local hashed path), with no server-only API involved, so nothing about it depends on a runtime server. This matches how every other purely-build-time Next.js feature behaves under export.

Practical effect for the migration: swap the two `<link>` Google Fonts tags for `next/font/google` imports of Fraunces and Inter in the root layout; both become same-origin static files under `_next/static/media/`, eliminating the current cross-origin `fonts.googleapis.com` / `fonts.gstatic.com` round-trips entirely.

---

## Q3 — `trailingSlash` and `basePath` for an apex custom domain

**`basePath`**: leave unset (default `''`). `basePath` exists to deploy under a *subpath* of a domain (e.g. `username.github.io/reponame` project-site URLs) ([basePath docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)). Once a custom domain is attached via the `CNAME` file / Pages settings, GitHub serves the site from the domain **root**, regardless of the repository's name — confirmed in GitHub's own custom-domain docs, which show the DNS `ALIAS`/`ANAME` target as `USERNAME.github.io` with no repo-name path segment ([Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)). So for `tilchi.uz`, `basePath` must be empty — setting it to anything else would break every internal link and asset path.

If you want this to self-configure instead of being hardcoded, the official [`actions/configure-pages`](https://github.com/actions/configure-pages) action exposes a `base_path` output documented as returning `"/my-repo"` **or `""`** depending on whether a custom domain is configured ([action.yml](https://github.com/actions/configure-pages/blob/main/action.yml)) — this is exactly the mechanism the official Next.js↔GitHub-Pages template wires into `next.config.ts` via `basePath: process.env.PAGES_BASE_PATH` (see Workflow section). For a project permanently pinned to one apex domain, hardcoding empty is simpler and equally correct — ponytail call: the dynamic plumbing solves a "might deploy to a subpath too" problem tilchi doesn't have.

**`trailingSlash`**: default is `false`, which exports `/about` as `/about.html` (extensionless route file, not a directory) ([trailingSlash docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash)). Setting it `true` exports `/about/index.html` instead, and is described in Next's own reference `next.config.js` for static export as the toggle for "`/me` → `/me/`" output ([static-exports guide config sample](https://nextjs.org/docs/app/guides/static-exports#configuration)).

Whether this matters for **GitHub Pages specifically**: GitHub Pages' file server resolves extensionless URLs (`/about`) directly to the matching `.html` file **without an HTTP redirect** — this is corroborated by a community writeup and a GitHub Community discussion, but I could not find this stated in GitHub's own official docs pages, so **flagging as medium-confidence, not confirmed by a primary GitHub source**: ([rsp.github.io writeup](https://rsp.github.io/gh-pages-no-extension/), [GitHub Community discussion #140005](https://github.com/orgs/community/discussions/140005)). Practically, this means both `trailingSlash` settings likely work on GH Pages, unlike a bare self-hosted nginx (Next's own nginx reference config explicitly needs a manual rewrite rule for the `false` case: *"This is necessary when `trailingSlash: false`. You can omit this when `trailingSlash: true`"* — [static-exports guide, "Deploying"](https://nextjs.org/docs/app/guides/static-exports#deploying)).

Older Next.js versions had real bugs combining `trailingSlash: true` with static-export 404 generation ([issue #16528](https://github.com/vercel/next.js/issues/16528), [issue #32699](https://github.com/vercel/next.js/issues/32699) — closed 2022, [issue #51042](https://github.com/vercel/next.js/issues/51042) — closed Feb 2025). Current source (`packages/next/src/export/index.ts`) writes `404.html` at the output root **unconditionally**, plus an additional `404/index.html` when `trailingSlash` is on — so this class of bug appears fixed as of 16.2.12; see Q4.

**Recommendation**: `trailingSlash: true`. Not strictly required on GitHub Pages per the above, but it's what Next's own docs treat as the "just works on any static host" setting, and it costs nothing here.

---

## Q4 — Custom 404: `app/not-found.tsx` under export, and does Pages serve it?

Two file conventions exist as of 16.2.12:

- **`app/not-found.tsx`** — renders when `notFound()` is thrown in a route segment, or for any unmatched URL app-wide (the root one). It renders inside your root layout (wrapped by `loading.js`'s Suspense boundary and `error.js`'s error boundary), so it inherits your fonts/header/footer automatically. ([not-found.js file convention docs](https://nextjs.org/docs/app/api-reference/file-conventions/not-found))
- **`app/global-not-found.tsx`** *(experimental, added 16.2.12's docs cite v15.4.0)* — bypasses layout rendering entirely and must be a full `<html>`/`<body>` document; opt in via `experimental: { globalNotFound: true }` in `next.config.ts`. Exists specifically for apps with multiple root layouts. Not relevant to this single-layout site — mentioned for completeness only. ([same doc, "global-not-found.js"](https://nextjs.org/docs/app/api-reference/file-conventions/not-found))

Under `output: 'export'`, current export source special-cases the `/_not-found` route and copies its rendered HTML to `404.html` at the output root unconditionally, plus `404/index.html` too if `trailingSlash` is on:

```ts
// packages/next/src/export/index.ts (canary, current)
if (unnormalizedRoute === '/_not-found') {
  // ...
  const htmlDest404 = join(outDir, '404.html')
  await fs.copyFile(htmlSrc, htmlDest404)
  if (subFolders) {
    const htmlDest404Index = join(outDir, '404', 'index.html')
    await fs.copyFile(htmlSrc, htmlDest404Index)
  }
}
```
([source](https://github.com/vercel/next.js/blob/canary/packages/next/src/export/index.ts))

**Does GitHub Pages serve it?** Yes — GitHub Pages' own custom-404 mechanism specifically looks for a `404.html` at the site root ([Creating a custom 404 page for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)), which is exactly what the export step above unconditionally produces. No extra wiring needed beyond having `app/not-found.tsx` in the project.

---

## Q5 — Is `.nojekyll` required for `_next/`?

**Not required for this repo's deployment architecture**, and this is a repo-specific answer, not a generic one.

`.nojekyll` matters only because GitHub's *legacy Jekyll build pipeline* treats any file/folder starting with an underscore as a special Jekyll resource and drops it from the published site — `_next/` would be exactly such a folder ([GitHub Blog: "Bypassing Jekyll on GitHub Pages"](https://github.blog/news-insights/bypassing-jekyll-on-github-pages/)).

That pipeline only runs for **branch-based publishing** (Settings → Pages → Source: a branch). tilchi's current `.github/workflows/static.yml` already uses the **GitHub Actions publishing source** (`actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`), which does not invoke Jekyll at all: *"If you want to use a build process other than Jekyll... we recommend that you write a GitHub Actions workflow to publish your site"* ([Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)). This is also why the official `nextjs/deploy-github-pages` template's workflow contains no `.nojekyll` step at all ([workflow source](https://github.com/nextjs/deploy-github-pages/blob/main/.github/workflows/deploy.yml)) — contrast with Next's own *legacy* `examples/github-pages` template, which uses the old `git subtree push` branch method and does `touch out/.nojekyll` for exactly that reason ([examples/github-pages package.json](https://github.com/vercel/next.js/blob/canary/examples/github-pages/package.json)).

One adjacent gotcha worth knowing: `actions/upload-pages-artifact` excludes dot-prefixed files/directories from the artifact by default (`--exclude=.[^/]*`) unless you pass `include-hidden-files: true` ([action.yml](https://github.com/actions/upload-pages-artifact/blob/main/action.yml)). This doesn't affect `_next/` (underscore, not dot), so it's a non-issue here — but if you ever *did* need a dotfile served (a `.well-known/` directory for domain verification, say), you'd need that input.

**Net: don't add `.nojekyll`. It would be inert either way** given the current pipeline, but there's no reason to carry dead config.

---

## Q6 — What breaks silently vs. loudly

### Loud (build fails outright)

| Feature | Behavior | Source |
|---|---|---|
| Server Actions | `ExportError` thrown | [export/index.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/export/index.ts) |
| Intercepting routes | `ExportError` thrown | same |
| Default image loader without `unoptimized`/custom loader | `Error` thrown | same |
| `dynamic = 'force-dynamic'` | `StaticGenBailoutError` thrown | [create-component-tree.tsx](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-component-tree.tsx) |
| `i18n` config | `Error` thrown | [config.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/config.ts) |
| Reading `cookies()` / other dynamic APIs without opting a route out | Forced `dynamic = 'error'` by default under export → build-time error | [create-component-tree.tsx](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-component-tree.tsx) |
| Dynamic route (`[slug]`) without `generateStaticParams()` | Documented unsupported, build-time constrained | [static-exports guide](https://nextjs.org/docs/app/guides/static-exports#unsupported-features) |

### Silent (build succeeds; wrong behavior only shows up at runtime, or never)

| Feature | Behavior | Source |
|---|---|---|
| `rewrites` / `redirects` / `headers` in `next.config` | Only a **yellow warning** in build logs ("will not automatically work with `output: export`"); config is then simply ignored — GitHub Pages has no server to apply it | [config.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/config.ts) |
| `middleware.ts` | Only a **yellow warning**; middleware then never executes on the deployed site — no error at request time, it just doesn't run | [export/index.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/export/index.ts) |
| API routes / Route Handlers that read the incoming `Request` | Same warning path; the route is simply absent from `out/` with no per-route error | same |
| `revalidate` / ISR | Docs state flatly **"not supported with static exports"** ([ISR guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/incremental-static-regeneration.mdx)), but I could not find source confirming whether setting `revalidate` on a page under `output: 'export'` throws or is silently ignored. **Unconfirmed — treat as silent** (most likely outcome: page freezes at build-time content forever, no error) until verified against a real build. |

The `rewrites`/`redirects`/`headers`/middleware row is the one most worth flagging for this migration specifically: a warning buried in CI build logs is easy to never see, and the failure mode is "the feature quietly does nothing in production," not a red X anywhere.

---

## Q7 — Version

All findings above are against **Next.js 16.2.12** (`npm view next version` / npm registry `dist-tags.latest`, released 2026-07-25) and its live documentation at `nextjs.org/docs` (pages fetched carry `version: 16.2.12` frontmatter, most recently updated 2026-07-22). Static export as `output: 'export'` has been the stable mechanism since **v13.3.0** (replacing the old `next export` CLI command, which was fully removed in **v14.0.0**) — so none of this is exotic/bleeding-edge, but re-check this doc if the project's actual installed version drifts far from 16.x by the time the migration happens, given the ticket's own warning that "this area changes release to release."

---

## Workflow: does `.github/workflows/static.yml` need replacing?

**Yes.** The current workflow uploads `path: '.'` (the whole repo) straight to Pages with zero build step — correct for a single static `index.html`, but a Next.js export needs an actual `next build` first, and the artifact path needs to point at `out/`, not the repo root.

The current file already uses the modern Actions publishing pipeline (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v5`), which is the right foundation — it just needs Node setup, install, and build steps inserted. Two things I checked concretely, not from memory:

1. **Current recommended shape**: Next.js's docs point directly at an official template for this — *"To deploy to GitHub Pages, use our [template](https://github.com/nextjs/deploy-github-pages) to create a new project or as a reference for configuring an existing project"* ([static-exports guide, "Deploying"](https://nextjs.org/docs/app/guides/static-exports#deploying)). Its workflow ([source](https://github.com/nextjs/deploy-github-pages/blob/main/.github/workflows/deploy.yml)):
   - checkout → setup package manager/Node → install deps → `configure-pages` (captures `base_path` output) → cache `.next/cache` → `next build` (with `PAGES_BASE_PATH` env feeding `next.config.ts`) → `upload-pages-artifact` with `path: ./out` → `deploy-pages`.
   - For tilchi's apex-domain case, the `base_path` plumbing can be dropped entirely (see Q3) — just build and upload `./out`.

2. **Action versions are currently newer than what's pinned**: as of this research (2026-07-31), latest majors are `configure-pages@v6.0.0` (published 2026-03-25), `upload-pages-artifact@v5.0.0` (2026-04-10), `deploy-pages@v5.0.0` (2026-03-25) — checked directly against each repo's `/releases/latest` API. The current `static.yml` pins `configure-pages@v5` and `upload-pages-artifact@v3` (both behind), `deploy-pages@v5` (current). Worth bumping when the workflow is rewritten; **I have not audited changelogs for breaking changes between these majors**, so treat the bump as "use current, re-test" rather than assumed drop-in.

Minimal replacement shape (adapt package manager/Node version to whatever the project ends up using):

```yaml
# build job additions before the existing upload step:
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'npm'
- run: npm ci
- run: npm run build   # next build, with output: 'export' in next.config.ts
- uses: actions/upload-pages-artifact@v5
  with:
    path: ./out          # not '.' — this is the key change
```

### CNAME file — no action needed

tilchi's `CNAME` file (currently `tilchi.uz` at repo root) does **not** need to be routed into `public/CNAME` so it survives into `out/`. Confirmed directly from GitHub's own docs: *"If you are publishing from a custom GitHub Actions workflow, no `CNAME` file is created, and any existing `CNAME` file is ignored and is not required"* ([Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)) — corroborated by a real-world report against `actions/deploy-pages` describing exactly this behavior change from the old branch-based flow ([actions/deploy-pages#304](https://github.com/actions/deploy-pages/issues/304), closed). Since `static.yml` already uses the Actions pipeline today, the domain is already controlled by the repository's Settings → Pages configuration, not by the file in the tree — the existing `CNAME` file is effectively vestigial already. Worth confirming empirically after the first post-migration deploy (Settings → Pages still shows `tilchi.uz` + HTTPS enforced) rather than assuming, since this is exactly the kind of area with conflicting third-party claims online.

---

## Explicit gaps (could not confirm, flagging rather than guessing)

- **`next/font` + `output: 'export'`**: compatible by every indication (build-time only, not listed as unsupported), but no docs sentence explicitly states the combination is supported.
- **`revalidate`/ISR under export**: docs say unsupported; whether it throws or silently no-ops at build time is not confirmed from source I could access.
- **`trailingSlash` necessity on GitHub Pages specifically**: community-sourced (blog + GitHub Community discussion), not stated in GitHub's official docs pages.
- **Action version bump (v3→v5, v5→v6)**: confirmed the version gap exists; did not audit changelogs for breaking changes.
