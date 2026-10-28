import type { Field } from './registration'

export type Lang = 'uz' | 'ru' | 'en'

type Copy = {
  confirmLogin: (context: string) => string
  confirmButton: string
  expired: string
  confirmed: string
  notYours: string
  privacy: string
  consentButton: string
  prompts: Record<Field, string>
  invalid: string
  shareContact: string
  done: string
  alreadyRegistered: string
  openApp: string
  revoked: (count: number) => string
}

export const COPY: Record<Lang, Copy> = {
  uz: {
    confirmLogin: (context) =>
      `Tilchi veb-ilovasiga kirishni tasdiqlaysizmi?\n\nSo‘rov: ${context}\n\nBu so‘rovni o‘zingiz boshlamagan bo‘lsangiz, tasdiqlamang.`,
    confirmButton: 'Tasdiqlash',
    expired:
      'Havola eskirgan yoki boshqa foydalanuvchiga tegishli. Saytdan qaytadan urinib ko‘ring.',
    confirmed: 'Tasdiqlandi. Brauzerga qayting.',
    notYours: 'Havola eskirgan yoki sizniki emas.',
    privacy:
      'Ro‘yxatdan o‘tish uchun ismingiz, ingliz tili darajangiz, o‘qish tarixingiz, telefon raqamingiz va maqsadingiz saqlanadi. Ma’lumotlar dars tashkil qilish va siz bilan bog‘lanish uchun ishlatiladi. Telegram xabarlari O‘zbekistondan tashqaridagi serverlar orqali yetkaziladi, AI yordamchi so‘rovlari esa xorijiy model provayderiga yuboriladi. Davom etish orqali shu transchegaraviy qayta ishlashga rozilik bildirasiz.',
    consentButton: 'Roziman',
    prompts: {
      name: 'Ismingiz va familiyangiz?',
      level:
        'Ingliz tili darajangiz? (boshlovchi, o‘rta yoki bilmayman deb yozing)',
      studyHistory: 'Ingliz tilini oldin qayerda va qancha o‘qigansiz?',
      phone:
        'Telefon raqamingiz? Pastdagi tugma bilan ulashing yoki +998901234567 ko‘rinishida yozing.',
      goal: 'Maqsadingiz va qachon boshlamoqchisiz?',
    },
    invalid: 'Tushunmadim. Iltimos, qaytadan yozing.',
    shareContact: 'Raqamni ulashish',
    done: 'Rahmat! Arizangiz qabul qilindi. Tez orada siz bilan bog‘lanamiz.',
    alreadyRegistered: 'Siz allaqachon ro‘yxatdan o‘tgansiz.',
    openApp: 'Tilchi’ni ochish',
    revoked: (count) =>
      `Barcha qurilmalardagi seanslar yakunlandi (${count}). Qayta kirish uchun saytdagi “Telegram orqali kirish”dan foydalaning.`,
  },
  ru: {
    confirmLogin: (context) =>
      `Подтвердить вход в веб-приложение Tilchi?\n\nЗапрос: ${context}\n\nЕсли вы не начинали этот запрос, не подтверждайте.`,
    confirmButton: 'Подтвердить',
    expired:
      'Ссылка устарела или принадлежит другому пользователю. Попробуйте снова с сайта.',
    confirmed: 'Подтверждено. Вернитесь в браузер.',
    notYours: 'Ссылка устарела или не ваша.',
    privacy:
      'Для регистрации сохраняются ваше имя, уровень английского, опыт обучения, номер телефона и цель. Данные нужны для организации занятий и связи с вами. Сообщения Telegram доставляются через серверы за пределами Узбекистана, а запросы к ИИ-помощнику уходят иностранному провайдеру модели. Продолжая, вы соглашаетесь на такую трансграничную обработку.',
    consentButton: 'Согласен',
    prompts: {
      name: 'Как вас зовут (имя и фамилия)?',
      level:
        'Ваш уровень английского? (напишите: начальный, средний или не знаю)',
      studyHistory: 'Где и сколько вы раньше учили английский?',
      phone:
        'Ваш номер телефона? Поделитесь кнопкой ниже или напишите в виде +998901234567.',
      goal: 'Ваша цель и когда хотите начать?',
    },
    invalid: 'Не понял. Пожалуйста, напишите ещё раз.',
    shareContact: 'Поделиться номером',
    done: 'Спасибо! Заявка принята. Скоро свяжемся с вами.',
    alreadyRegistered: 'Вы уже зарегистрированы.',
    openApp: 'Открыть Tilchi',
    revoked: (count) =>
      `Все сеансы на всех устройствах завершены (${count}). Чтобы войти снова, используйте «Войти через Telegram» на сайте.`,
  },
  en: {
    confirmLogin: (context) =>
      `Confirm sign-in to the Tilchi web app?\n\nRequest: ${context}\n\nIf you did not start this request, do not confirm.`,
    confirmButton: 'Confirm',
    expired:
      'This link has expired or belongs to another user. Try again from the site.',
    confirmed: 'Confirmed. Return to your browser.',
    notYours: 'This link has expired or is not yours.',
    privacy:
      'To register we store your name, English level, study history, phone number and goal. We use them to organise lessons and contact you. Telegram delivers bot messages through servers outside Uzbekistan, and AI helper requests go to a foreign model provider. By continuing you consent to this cross-border processing.',
    consentButton: 'I agree',
    prompts: {
      name: 'Your first and last name?',
      level: 'Your English level? (write beginner, intermediate or not sure)',
      studyHistory: 'Where and for how long have you studied English before?',
      phone:
        'Your phone number? Share it with the button below or type it like +998901234567.',
      goal: 'Your goal and when would you like to start?',
    },
    invalid: 'I did not get that. Please send it again.',
    shareContact: 'Share my number',
    done: 'Thanks! Your registration is in. We will contact you soon.',
    alreadyRegistered: 'You are already registered.',
    openApp: 'Open Tilchi',
    revoked: (count) =>
      `All sessions on all devices have ended (${count}). To sign in again use "Sign in with Telegram" on the site.`,
  },
}
