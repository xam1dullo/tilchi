# 0003. Roles

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Decision

Roles are learner, teacher, and admin. There is no parent role. Marketing copy may still speak to parents. A learner can open `/app` with no Group and sees the empty state plus a catalog link. Group membership changes are admin-only. Group create is admin or teacher. Teacher and admin accounts come from an allow-list in the bot. Admin UI stays inside `/app`.
