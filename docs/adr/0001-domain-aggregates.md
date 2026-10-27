# 0001. Domain aggregates

Date: 2026-10-27
Amended: 2026-10-28
Status: accepted

## Context

Tilchi teaches English to groups of at most 12. The Mac working copies of ADRs 0001–0006 were not in this repository. This record freezes the domain from the 2026-10-27 build brief.

## Decision

English code names are Group, Course, Lesson, and Meeting, plus a later Question bank. A Lesson is one Group at a scheduled time plus a Meeting. Status moves scheduled, live, ended, or cancelled. Attendance is a LiveKit join. A Course is the public catalog. A 1:1 is a Group with one learner. Primary keys are UUID v7. User, Group, and Course soft-delete. The product is single-tenant. Time is Asia/Tashkent.

## Consequences

The Drizzle skeleton in `apps/api/src/db/schema.ts` matches these names. Question-bank and billing tables wait.

Phase 1 enforces the rules in `apps/api` (`groups`, `lessons`). A Group holds at most 12 learners; the teacher is not counted. The count is checked in the transaction that adds a member, under a row lock on the Group, so two concurrent adds cannot overbook it. A Lesson is created together with its Meeting in one transaction. Its status changes only by compare-and-set: start (scheduled to live), end (live to ended), cancel (scheduled to cancelled). Nothing moves back. A learner sees the Groups and Lessons they belong to, a teacher the Groups they teach, an admin all of them. The only audit trail is `created_by` and `added_by`.
