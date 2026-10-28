# 0010. Docker Compose on a UZ VPS

Date: 2026-10-27
Status: accepted (production deploy held until audit and owner approval)
Supersedes: 0007, 0008

## Context

The earlier plan ran the app on Cloudflare Workers, Containers, D1, and Pages (0007, 0008). Live classes need LiveKit, which needs host UDP for media and long-lived WebSockets. The rest of the stack (Nest, Postgres, Redis, canvas pub/sub) is simpler as plain processes next to it. One small VPS in Uzbekistan keeps media close to learners and keeps one origin for the session cookie.

## Decision

### Runtime

Docker Compose on one VPS. Cloudflare is DNS-only (no proxy) plus R2 for audio objects. No Workers, Containers, D1, or Pages for the app.

| Service  | Image                                 | Reachable from outside                               |
| -------- | ------------------------------------- | ---------------------------------------------------- |
| nginx    | `nginx:1.27-alpine`                   | 80/tcp, 443/tcp                                      |
| start    | `ghcr.io/xam1dullo/tilchi/web:<sha>`  | no (nginx only)                                      |
| nest     | `ghcr.io/xam1dullo/tilchi/api:<sha>`  | no (nginx only)                                      |
| postgres | `postgres:17-alpine`                  | no                                                   |
| redis    | `redis:7.4-alpine` (password in prod) | no                                                   |
| livekit  | `livekit/livekit-server:v1.8.4`       | signaling via nginx `/rtc`; 7881/tcp, 7882/udp media |
| coturn   | `coturn/coturn:4.6.2`                 | 3478/udp+tcp, 49160-49200/udp relay                  |

`docker-compose.yml` is the production shape: secrets use `${VAR:?}` and there are no silent dev defaults. `docker-compose.dev.yml` fills local defaults only. `docker-compose.prod.yml` swaps `build:` for ghcr images by git SHA, adds TLS, and passes the public node IP. A missing secret stops `compose` before anything starts.

### Paths (one origin)

nginx owns the path contract in `docker/nginx/locations.conf`. Dev (`dev.conf.template`) and prod (`prod.conf.template`) include the same file.

| Path                                      | Upstream                                        |
| ----------------------------------------- | ----------------------------------------------- |
| `/api/` `/auth/` `/bot/`                  | Nest                                            |
| `/ws/canvas`                              | Nest (Excalidraw live, Redis pub/sub)           |
| `/rtc/`                                   | LiveKit signaling (prefix stripped)             |
| `/ai/`                                    | Start (OpenAI or Anthropic via env, unbuffered) |
| `/` `/app` `/slide` `/canvas` `/app/meet` | Start                                           |
- Browsers call Nest directly on the same origin, so Nest sets `__Host-tilchi_sid` (HttpOnly, Secure, SameSite=Lax, Path=/, no Domain).
- Clients connect to LiveKit at `wss://<domain>/rtc`. The SDK appends `/rtc`, so `/rtc/rtc?...` reaches LiveKit as `/rtc?...`.
- Every `proxy_set_header` sits at server level. A location that sets its own header drops all inherited ones.
- nginx is the edge, so it overwrites `X-Forwarded-For` with the TCP peer. Nest trusts one proxy hop (`trust proxy 1`) and rate-limits on `req.ip`.

### Images and tags

A push to `main` builds `web` and `api` and pushes them to ghcr, tagged with the full git SHA. There is no `latest` tag. PR CI does not build images.

### Deploy (held)

The order is fixed in `scripts/vps-deploy.sh <sha>`:

1. Check out `<sha>` in the VPS checkout (`/opt/tilchi`).
2. `compose config` with `/etc/tilchi.env`. A missing secret fails here.
3. Pull `web` and `api` at `<sha>`.
4. Start postgres and redis, then run `node dist/db/migrate.js` in a one-off nest container.
5. `compose up -d --no-build --wait`, then record `.deployed-sha` and `.previous-sha`.

The `deploy` job in `main-build-push.yml` runs only by `workflow_dispatch`, inside the GitHub `production` environment, and currently exits before any SSH. A push to `main` never migrates or deploys.

Unholding needs all of these:

- Owner approval.
- Required reviewers on the `production` environment.
- A decided SSH path (see open items).

### Rollback

Run `scripts/vps-deploy.sh <previous sha>`, or dispatch the deploy job with that SHA. Migrations are forward-only, so rolling back across a migration needs a written plan in the PR that added it.

### TLS

Let's Encrypt with certbot on the host in webroot mode. Certificates live in `/etc/letsencrypt` and the challenge directory is `/var/www/certbot`. Both are mounted read-only into nginx. The renewal hook runs `docker compose exec nginx nginx -s reload`. Unknown hosts get `444` on port 80 and a rejected handshake on 443.

### Firewall

The firewall opens 80/tcp, 443/tcp, 7881/tcp, 7882/udp, 3478/udp+tcp, and 49160-49200/udp. SSH is not public.

Docker-published ports bypass `ufw`. Only the ports listed above are published, and postgres, redis, nest, start, and LiveKit 7880 publish nothing.

### Secrets

Secrets live only in `/etc/tilchi.env` (root, mode 0600). In git, `.env.example` holds names and local dev values only.

`docker-compose.prod.yml` passes each service only the variables it needs. It has no `env_file`.

In production, Nest refuses to boot when any of these is true:

- `DATABASE_URL` or `REDIS_URL` is missing.
- `TELEGRAM_WEBHOOK_SECRET` is not 32-256 chars of `[A-Za-z0-9_-]`.
- The LiveKit keys are missing or still the `devkey`/`devsecret` pair.

The boot errors name the variable and never print its value. `docker/livekit/entrypoint.sh` writes that pair into the server config and execs `/livekit-server` (absolute path). In production it also passes `--node-ip`. coturn's entrypoint writes credentials from env and refuses to relay into private ranges.

### Security must-not-repeat (2026-10-28 review)

| Rule                                                            | Enforced in                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Webhook secret required, refused if unset in prod, no IP bypass | `apps/api/src/bot/webhook-guard.ts`; boot guard `apps/api/src/config.ts`      |
| Gated deploy, no ungated migrate+deploy on `main`               | `main-build-push.yml` (`workflow_dispatch` + `environment: production`, held) |
| HttpOnly `__Host-tilchi_sid` only, no bearer, no localStorage   | `apps/api/src/auth/policy.ts`, `apps/web/src/security.test.ts`                |
| Health has no secret flags                                      | `apps/api/src/health/health.test.ts`                                          |
| Meet ticket short-lived, session token never sent to peers      | `apps/api/src/meet/ticket.ts` (60 s random ticket)                            |

## Consequences

- Local development is `cp .env.example .env && docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`. Production adds `docker-compose.prod.yml` and `/etc/tilchi.env`.
- One VPS is a single point of failure. That is accepted for v1 (1-3 concurrent rooms of up to 12).
- `pgdata` backups are not yet defined and must exist before the first real learner.

## Open items

1. The SSH path for CI. "SSH not public" conflicts with "GHA SSH deploy". Pick one: a self-hosted runner on the VPS, a private tunnel (Tailscale or WireGuard) from the runner, or a pull-based deploy on the VPS. This is a PM decision.
2. The `production` environment does not exist on GitHub yet. Referencing it creates it with no reviewers, so the owner must add required reviewers before unholding.
3. LiveKit does not yet hand coturn to clients (`rtc.turn_servers`). The entrypoint templates the LiveKit config from env; the TURN server list is still not advertised.
4. The domain (`tilchi.uz` or `app.tilchi.uz`) and the marketing cut-over from Cloudflare Pages are undecided.
5. Postgres backup and restore drill.
