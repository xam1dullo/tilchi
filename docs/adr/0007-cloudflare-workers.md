# 0007. Cloudflare Workers runtime

Date: 2026-10-27
Status: superseded by 0010

## Context

An earlier plan ran the app on Cloudflare Workers, Containers, and D1.

## Decision

That runtime is not used. Cloudflare stays DNS-only, plus R2 for audio objects.

## Consequences

Do not add a Workers deploy, D1 schema, or container binding for the app server.
