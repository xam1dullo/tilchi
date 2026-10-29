import type { Locale } from '../locale'

// Kept out of uz/ru/en.ts on purpose: those load with every page, this copy
// ships only in the lazy AI helper chunk.
const uz = {
  aiOpen: 'AI yordamchi',
  aiTitle: 'Dars yordamchisi',
  aiClose: 'Yopish',
  aiHint:
    "Dars mavzusi bo'yicha inglizcha savol bering. Test va savollar tuzmaydi.",
  aiLabel: 'Savolingiz',
  aiAsk: 'Yuborish',
  aiStop: "To'xtatish",
  aiQuestion: 'Savol',
  aiAnswer: 'Javob',
  aiWorking: 'Javob yozilmoqda…',
  aiDone: 'Javob tayyor.',
  aiStopped: "To'xtatildi.",
  aiEmpty: "Hali savol yo'q.",
  aiDisabled: 'AI yordamchi serverda hali yoqilmagan.',
  aiLimit: "Savollar limiti tugadi. Keyinroq urinib ko'ring.",
  aiForbidden: 'Bu dars uchun AI yordamchi mavjud emas.',
  aiPersonal:
    'Ismingiz yoki shaxsiy ma’lumotingizni yozmang — savolni qaytadan yozing.',
  aiUnavailable: "Javob olinmadi. Qayta urinib ko'ring.",
}

export type AiCopy = typeof uz

const ru: AiCopy = {
  aiOpen: 'AI-помощник',
  aiTitle: 'Помощник урока',
  aiClose: 'Закрыть',
  aiHint:
    'Задайте вопрос по английскому в рамках урока. Тесты и вопросы он не составляет.',
  aiLabel: 'Ваш вопрос',
  aiAsk: 'Отправить',
  aiStop: 'Остановить',
  aiQuestion: 'Вопрос',
  aiAnswer: 'Ответ',
  aiWorking: 'Ответ пишется…',
  aiDone: 'Ответ готов.',
  aiStopped: 'Остановлено.',
  aiEmpty: 'Вопросов пока нет.',
  aiDisabled: 'AI-помощник на сервере ещё не включён.',
  aiLimit: 'Лимит вопросов исчерпан. Попробуйте позже.',
  aiForbidden: 'AI-помощник для этого урока недоступен.',
  aiPersonal: 'Не пишите своё имя и личные данные — переформулируйте вопрос.',
  aiUnavailable: 'Ответ не получен. Попробуйте ещё раз.',
}

const en: AiCopy = {
  aiOpen: 'AI helper',
  aiTitle: 'Lesson helper',
  aiClose: 'Close',
  aiHint:
    'Ask an English question about this lesson. It does not write tests or questions.',
  aiLabel: 'Your question',
  aiAsk: 'Send',
  aiStop: 'Stop',
  aiQuestion: 'Question',
  aiAnswer: 'Answer',
  aiWorking: 'Writing the answer…',
  aiDone: 'Answer ready.',
  aiStopped: 'Stopped.',
  aiEmpty: 'No questions yet.',
  aiDisabled: 'The AI helper is not enabled on the server yet.',
  aiLimit: 'Question limit reached. Try again later.',
  aiForbidden: 'The AI helper is not available for this lesson.',
  aiPersonal:
    'Please leave out your name and personal details, then ask again.',
  aiUnavailable: 'No answer received. Try again.',
}

export const aiCopy: Record<Locale, AiCopy> = { uz, ru, en }
