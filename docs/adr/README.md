# Architecture decision records

| ADR                                       | Title                                | Status                |
| ----------------------------------------- | ------------------------------------ | --------------------- |
| [0001](0001-domain-aggregates.md)         | Domain aggregates                    | accepted              |
| [0002](0002-telegram-session.md)          | Telegram session and webhook         | accepted              |
| [0003](0003-roles.md)                     | Roles                                | accepted              |
| [0004](0004-kunduzgi-tokens.md)           | Kunduzgi studiya tokens              | accepted              |
| [0005](0005-locale-and-time.md)           | Locale and time                      | accepted              |
| [0006](0006-identity-and-retention.md)    | Identity and retention               | accepted              |
| [0007](0007-cloudflare-workers.md)        | Cloudflare Workers runtime           | superseded by 0010    |
| [0008](0008-cloudflare-pages.md)          | Cloudflare Pages for the site        | superseded by 0010    |
| [0009](0009-livekit.md)                   | LiveKit meetings                     | accepted              |
| [0010](0010-docker-vps.md)                | Docker Compose on a UZ VPS           | accepted, deploy held |
| [0011](0011-in-country-object-storage.md) | In-country storage for learner audio | accepted              |
| [0012](0012-phase-1-classroom.md)         | Phase 1 classroom loop               | accepted              |

0001–0006 were reconstructed from `docs/archive/BUILD-BRIEF-v1.md`. The Mac originals are not ported yet. A new decision gets the next number. Never edit a superseded record; supersede it.
