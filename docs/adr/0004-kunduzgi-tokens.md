# 0004. Kunduzgi studiya tokens

> **Superseded in part by the terracotta/Onest rebrand (PR #102, 2026-10-31).** Accent is now terracotta `#D93A1C` (text-safe `--accent #B8301A`), body font Onest, `--meet-bg` `#141413`. Current values: `design.md` §01–§02 and `apps/web/src/styles/tokens.css`. Green/Geist/`#151A17` below are historical.

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1 and `design.md`. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Decision

App chrome keeps the Kunduzgi studiya tokens from `design.md`: paper, ink, one accent (green at the time; terracotta since PR #102), hairlines, Fraunces display, Geist text (Onest since PR #102). Tokens live in one flat `:root` in `apps/web/src/styles/tokens.css`. Fraunces Variable has no Cyrillic subset, so `html[lang="ru"]` uses the sans face for headings (Geist then, Onest now). Light theme only.

`/app/meet` may later paint video tiles on `--meet-bg` (`#151A17` then, `#141413` now) with a light control bar. Phase 1 does not ship that route. A meet control ticket is short-lived and is not the session cookie. See 0009.

Phase 1 `/` is a typographic hero and the Telegram button. The full landing sections stay in `design.md` for a later port. Do not render a cohort label.
