# 0011. In-country object storage for learner audio

Date: 2026-10-28
Status: accepted (PM decision C1, PRD v1.2)

## Context

BUILD-BRIEF-v1 put speaking-test audio on Cloudflare R2. A learner's recorded voice is personal data. Law ZRU-547 "On personal data", Art. 27¹ (added 2021), requires personal data of Uzbek citizens processed over the internet to be stored on hardware physically in Uzbekistan. R2 has no Uzbekistan location.

## Decision

- Learner audio lives in S3-compatible storage on the UZ VPS: a MinIO service in Docker Compose, reachable only on the compose network, with a persistent volume and credentials from `/etc/tilchi.env`.
- Nest issues short-lived presigned PUT and GET URLs, the same API shape R2 would have used. Object keys carry no personal data (`audio/<attemptId>/<answerId>.webm`).
- R2 stays for non-personal static assets only.
- Bucket backups follow the Postgres backups: nightly, copied off the VPS but inside Uzbekistan.

## Consequences

- One more container on the VPS (about 256 MB RAM at v1 volume).
- Moving to a UZ cloud object store later is a config change (endpoint and keys), not a code change.

## Open

- The audio retention purge (180 days after grading) lands with the hardening phase.
