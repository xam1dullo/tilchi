# 0004. Kunduzgi studiya tokens

Date: 2026-10-27
Status: accepted

## Decision

App chrome keeps the Kunduzgi studiya tokens from `design.md`: paper, ink, one green, hairlines, Fraunces display, Geist text. Tokens live in one flat `:root` in `apps/web/src/styles/tokens.css`. Fraunces Variable has no Cyrillic subset, so `html[lang="ru"]` uses Geist for headings. Light theme only.

`/app/meet` may later paint video tiles on `--meet-bg` (`#151A17`) with a light control bar. Phase 1 does not ship that route. A meet control ticket is short-lived and is not the session cookie. See 0009.

Phase 1 `/` is a typographic hero and the Telegram button. The full landing sections stay in `design.md` for a later port. Do not render a cohort label.
