# 0006. Identity and retention

Date: 2026-10-27
Status: accepted

## Decision

Primary keys are UUID v7 generated in the API. User, Group, and Course rows soft-delete. The deployment is one tenant. Admin and teacher critical actions will be audited. There is no payment ledger in v1.
