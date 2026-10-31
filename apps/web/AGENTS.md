# apps/web — local rules

Read the root `AGENTS.md` first. Details: `design.md`, `docs/agents/architecture.md`.

- **Design:** use the Kunduzgi tokens in `src/styles/tokens.css`; no hex values in components. Light app; ink-dark for meeting tiles and the `/app` desktop sidebar (owner-requested cabinet shell; see `design.md`).
- **Copy:** every string goes in `src/lib/i18n` with uz, ru and en; no hard-coded UI text.
- **Permissions:** show actions only from the server's `can` flags. Never derive permissions from the role in the browser.
- **Session:** never read or store auth in localStorage or sessionStorage.
- **Accessibility:** WCAG 2.2 AA (`pnpm contrast`), 44 px touch targets, visible focus, keyboard reachable, `prefers-reduced-motion` respected.
- **Performance:** keep initial JS for `/` and `/app` flat; load heavy code (LiveKit, AI sheet) lazily.
- **Logic:** keep view-state logic in pure functions in `src/lib` with unit tests.
