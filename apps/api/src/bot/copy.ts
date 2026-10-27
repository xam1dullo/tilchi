import type { BotLanguage } from './updates'

type Copy = {
  welcome: string
  prompt: (device: string, time: string) => string
  button: string
  confirmed: string
  expired: string
}

// Sentence case, no exclamation marks (design.md rule 08). Uzbek uses the
// same ASCII apostrophe as the web strings.
export const copy: Record<BotLanguage, Copy> = {
  uz: {
    welcome:
      'Tilchi: ingliz tili darslari. Saytga kirish uchun kirish sahifasidagi Telegram tugmasini bosing.',
    prompt: (device, time) =>
      `Tilchi saytiga kirish so'rovi.\nQurilma: ${device}\nVaqt: ${time} (Toshkent)\n\nBu siz bo'lsangiz, tasdiqlang. Aks holda xabarga e'tibor bermang.`,
    button: 'Tasdiqlash',
    confirmed: 'Kirish tasdiqlandi. Brauzerga qayting.',
    expired:
      'Havola muddati tugagan yoki allaqachon ishlatilgan. Saytda kirishni qayta boshlang.',
  },
  ru: {
    welcome:
      'Tilchi: занятия английским. Чтобы войти на сайт, нажмите кнопку Telegram на странице входа.',
    prompt: (device, time) =>
      `Запрос на вход на сайт Tilchi.\nУстройство: ${device}\nВремя: ${time} (Ташкент)\n\nЕсли это вы, подтвердите вход. Иначе проигнорируйте сообщение.`,
    button: 'Подтвердить',
    confirmed: 'Вход подтверждён. Вернитесь в браузер.',
    expired:
      'Срок ссылки истёк или она уже использована. Начните вход на сайте заново.',
  },
  en: {
    welcome:
      'Tilchi: English lessons. To sign in to the site, press the Telegram button on the sign-in page.',
    prompt: (device, time) =>
      `Sign-in request for the Tilchi site.\nDevice: ${device}\nTime: ${time} (Tashkent)\n\nConfirm only if this was you. Otherwise ignore this message.`,
    button: 'Confirm',
    confirmed: 'Sign-in confirmed. Return to your browser.',
    expired:
      'This link has expired or was already used. Start sign-in again on the site.',
  },
}
