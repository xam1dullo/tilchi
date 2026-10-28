# 0006. Identity and retention

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Decision

Primary keys are UUID v7 generated in the API. User, Group, and Course rows soft-delete. The deployment is one tenant. Admin and teacher critical actions will be audited. There is no payment ledger in v1.
