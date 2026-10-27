import type { Locale } from '../lib/locale'
import { writeLocaleCookie } from '../lib/locale'
import { messages } from '../lib/i18n'

const order: readonly Locale[] = ['uz', 'ru', 'en']

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const copy = messages(locale)
  return (
    <fieldset className="locale-switch">
      <legend>{copy.locale}</legend>
      {order.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === locale}
          onClick={() => {
            writeLocaleCookie(item)
            window.location.reload()
          }}
        >
          {item}
        </button>
      ))}
    </fieldset>
  )
}
