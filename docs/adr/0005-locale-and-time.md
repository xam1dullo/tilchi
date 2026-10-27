# 0005. Locale and time

Date: 2026-10-27
Status: accepted

## Decision

The product teaches English. The UI is Uzbek, Russian, and English. The default locale comes from the browser `Accept-Language` header, then a `tilchi_locale` cookie. Stored instants use `timestamptz`. Display uses Asia/Tashkent.
