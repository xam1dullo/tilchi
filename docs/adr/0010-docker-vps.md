# 0010. Docker Compose on a VPS

Date: 2026-10-27
Amended: 2026-10-28
Status: accepted
Supersedes: 0007, 0008

## Decision

The production runtime is Docker Compose on a UZ VPS: nginx, TanStack Start, NestJS, Postgres, Redis, LiveKit, and coturn. Images are `ghcr.io/<repo>/{web,api}:<git sha>`. TLS is Let's Encrypt on the VPS. The firewall opens 80, 443, and LiveKit/TURN UDP. SSH is not public. Secrets live in `/etc/tilchi.env`. `TELEGRAM_BOT_TOKEN` appears in git only as an empty name in `.env.example`.

Pushing `main` may build and push images. It does not migrate and it does not deploy. The deploy job runs only on `workflow_dispatch` with `deploy=true`, and only inside the GitHub `production` environment. The job is a stub that exits before any SSH or migration.

Images run as the `node` user. Each runtime image is `pnpm deploy --prod --legacy` output plus the build; pnpm 10+ refuses a plain deploy without injected workspace packages. Compose defaults `NODE_ENV` to `production`; local `.env` sets `development`.

Host ports: 80 (and 443 once certbot runs), LiveKit 7881/tcp and 50000–50020/udp, coturn 3478 and 49160–49200/udp. Postgres, Redis, Nest, Start, and LiveKit signaling are reachable only on the compose network or through nginx. The repo nginx serves port 80 only; the TLS server block and the ACME challenge path are added with the deploy job.

The GitHub `production` environment must exist with required reviewers before the deploy job does anything real. GitHub creates a missing environment on first use with no protection rules, so the gate is only real once an owner configures it.

## Consequences

Local development is `docker compose up`. Rollback, when deploy exists, is the previous image SHA.
