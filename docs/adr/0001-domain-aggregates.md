# 0001. Domain aggregates

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Context

Tilchi teaches English to groups of at most 12. The Mac working copies of ADRs 0001–0006 were not in this repository. This record freezes the domain from the 2026-10-27 build brief.

## Decision

English code names are Group, Course, Lesson, and Meeting, plus a later Question bank. A Lesson is one Group at a scheduled time plus a Meeting. Status moves scheduled, live, ended, or cancelled. Attendance is a LiveKit join. A Course is the public catalog. A 1:1 is a Group with one learner. Primary keys are UUID v7. User, Group, and Course soft-delete. The product is single-tenant. Time is Asia/Tashkent.

## Consequences

The Drizzle skeleton in `apps/api/src/db/schema.ts` matches these names. Question-bank and billing tables wait.
