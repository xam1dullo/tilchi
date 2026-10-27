export const locales = ['uz', 'ru', 'en'] as const
export type Locale = (typeof locales)[number]

export function parseLocale(value: string | undefined | null): Locale | null {
  if (value === 'uz' || value === 'ru' || value === 'en') return value
  return null
}

export function localeFromAcceptLanguage(header: string | null): Locale {
  const parts = (header ?? '')
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '')
  for (const part of parts) {
    if (part.startsWith('uz')) return 'uz'
    if (part.startsWith('ru')) return 'ru'
    if (part.startsWith('en')) return 'en'
  }
  return 'uz'
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `tilchi_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
}
