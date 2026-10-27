# 0003. Roles

Date: 2026-10-27
Status: accepted

## Decision

Roles are learner, teacher, and admin. There is no parent role. Marketing copy may still speak to parents. A learner can open `/app` with no Group and sees the empty state plus a catalog link. Group membership changes are admin-only. Group create is admin or teacher. Teacher and admin accounts come from an allow-list in the bot. Admin UI stays inside `/app`.
