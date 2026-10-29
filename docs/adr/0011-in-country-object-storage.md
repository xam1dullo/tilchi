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

## Implementation (PR 7a)

- Image: Docker Hub `minio/minio` and `quay.io/minio/minio` no longer pull anonymously, so compose uses the Chainguard MinIO build, pinned by digest. Revisit when a maintained official image returns.
- Signing: the API signs SigV4 query URLs itself (no AWS SDK). A presigned PUT pins `Content-Type` and `Content-Length` as signed headers (checked against a real MinIO: a larger body or other type gets 403), lives 180 s; playback GET lives 600 s.
- Host: a presigned URL is bound to the host it was signed for, so `S3_PUBLIC_URL` must be an origin (no path) that reaches MinIO unchanged. Production needs an nginx vhost and certificate for that host; it is not part of 7a.
- The API creates the bucket on boot (an existing one is fine), so there is no init container.

## Open

- The audio retention purge (180 days after grading) lands with the hardening phase.
