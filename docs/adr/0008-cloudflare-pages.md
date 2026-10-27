# 0008. Cloudflare Pages for the site

Date: 2026-10-27
Status: superseded by 0010

## Context

The previous Next site deployed as a static export to Cloudflare Pages.

## Decision

The site and the classroom are one TanStack Start app behind nginx on the VPS. Pages is not the app host.

## Consequences

`main-build-push.yml` pushes container images. It does not run Wrangler.
