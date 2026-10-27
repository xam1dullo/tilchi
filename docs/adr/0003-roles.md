# 0003. Roles

Date: 2026-10-27
Amended: 2026-10-28
Status: accepted

## Decision

Roles are learner, teacher, and admin. There is no parent role. Marketing copy may still speak to parents. A learner can open `/app` with no Group and sees the empty state plus a catalog link. Group membership changes are admin-only. Group create is admin or teacher. Teacher and admin accounts come from an allow-list in the bot. Admin UI stays inside `/app`.

## Phase 1 implementation

`TELEGRAM_ADMIN_ALLOWLIST` and `TELEGRAM_TEACHER_ALLOWLIST` each hold comma-separated Telegram user ids. A malformed entry never grants a role; it is skipped and logged at start. An id on both lists is an admin, and everyone else is a learner. The role is read when the Telegram user confirms a sign-in and is kept with the session, so a change to a list applies at the next sign-in.

Admins add and remove members. An admin or a teacher creates a Group: a teacher only for themselves, an admin for the teacher they name. The Group's teacher, or an admin, creates, starts, ends, and cancels its Lessons. Where the right depends on the role alone (create a Group, change members, delete a Group), the API answers 403 before it reads an id or a body. A Group or Lesson the caller may not see answers 404, and one they may see but not run answers 403, before the body is read.
