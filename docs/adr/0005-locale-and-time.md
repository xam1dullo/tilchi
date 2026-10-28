# 0005. Locale and time

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Decision

The product teaches English. The UI is Uzbek, Russian, and English. The default locale comes from the browser `Accept-Language` header, then a `tilchi_locale` cookie. Stored instants use `timestamptz`. Display uses Asia/Tashkent.
