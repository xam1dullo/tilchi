import type { LessonPayload, OutboxEvent, TestPayload } from './events'
import { TASHKENT_OFFSET_MS } from './quiet-hours'

export type Message = { title: string; body: string; link: string | null }

const pad = (n: number) => String(n).padStart(2, '0')

/** `28.10 19:00`, always Asia/Tashkent, 24-hour. */
export function tashkentTime(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS)
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

type Payload = Omit<Partial<LessonPayload>, 'lead'> &
  Omit<Partial<TestPayload>, 'lead'> &
  Record<string, unknown> & { at?: Date; lead?: string }

const tashkentDay = (d: Date) =>
  new Date(d.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10)

/** "ertaga" only while the lesson really is on another day than the send time. */
const reminderTitle = (p: Payload) => {
  if (p.lead === '15m') return 'Dars 15 daqiqadan so‘ng'
  const sameDay =
    p.at &&
    p.scheduledAt &&
    tashkentDay(p.at) === tashkentDay(new Date(p.scheduledAt))
  return sameDay ? 'Dars bugun' : 'Dars ertaga'
}

const groupLink = (p: Payload) =>
  p.groupId ? `/app/groups/${p.groupId}` : null
const attemptLink = (p: Payload) =>
  p.attemptId ? `/app/attempts/${p.attemptId}` : null
const when = (p: Payload) => tashkentTime(p.scheduledAt)

/**
 * Message text per event (Uzbek). Least personal data: only times and a link
 * into the app, never a phone number. The admin alert names the registrant so
 * the admin can reach them, as before.
 */
const RENDER: Partial<Record<OutboxEvent, (p: Payload) => Message>> = {
  'lesson.scheduled': (p) => ({
    title: 'Yangi dars',
    body: `Dars ${when(p)} da boshlanadi.`,
    link: groupLink(p),
  }),
  'lesson.reminder': (p) => ({
    title: reminderTitle(p),
    body: `Dars ${when(p)} da boshlanadi.`,
    link: groupLink(p),
  }),
  'lesson.started': (p) => ({
    title: 'Dars boshlandi',
    body: 'Darsga kirish uchun havolani bosing.',
    link: p.lessonId ? `/app/meet/${p.lessonId}` : null,
  }),
  'lesson.cancelled': (p) => ({
    title: 'Dars bekor qilindi',
    body: `${when(p)} dagi dars bekor qilindi.`,
    link: groupLink(p),
  }),
  'lesson.rescheduled': (p) => ({
    title: 'Dars vaqti o‘zgardi',
    body: `${tashkentTime(p.previousScheduledAt)} dagi dars ${when(p)} ga ko‘chirildi.`,
    link: groupLink(p),
  }),
  'test.assigned': (p) => ({
    title: 'Yangi test',
    body: `Test topshirish muddati: ${tashkentTime(p.deadline)}.`,
    link: '/app/assignments',
  }),
  'test.reminder': (p) => ({
    title: 'Test muddati yaqin',
    body: `Test topshirish muddati ${tashkentTime(p.deadline)} gacha. ${p.lead === '3h' ? 'Atigi 3 soat qoldi.' : '24 soatdan kam qoldi.'}`,
    link: '/app/assignments',
  }),
  'test.submitted': (p) => ({
    title: 'Test topshirildi',
    body: 'Bir o‘quvchi testni topshirdi. Baholash uchun oching.',
    link: attemptLink(p) ?? groupLink(p),
  }),
  'test.graded': (p) => ({
    title: 'Test baholandi',
    body: 'Testingiz baholandi. Natijani ko‘rish uchun oching.',
    link: attemptLink(p) ?? '/app/assignments',
  }),
  'sessions.revoked': () => ({
    title: 'Seanslar tugatildi',
    body: 'Barcha qurilmalardagi seanslar tugatildi. Qayta kirish uchun Telegram orqali tasdiqlang.',
    link: null,
  }),
  'registration.completed': (p) => ({
    title: 'New registration',
    body: [
      `Name: ${p.name}`,
      `Level: ${p.level}`,
      `Source: ${p.source ?? 'direct'}`,
      `Chat: tg://user?id=${p.telegramUserId}`,
    ].join('\n'),
    link: null,
  }),
}

/** `at` is the send time; it only changes the wording of the 24 h reminder. */
export const renderMessage = (
  event: OutboxEvent,
  payload: Record<string, unknown>,
  at?: Date,
): Message | null => RENDER[event]?.({ ...payload, at } as Payload) ?? null

/** Telegram text: title, body, and the app link when the public app url is known. */
export function telegramText(message: Message, appUrl: string | undefined) {
  const link =
    message.link && appUrl ? `${appUrl.replace(/\/$/, '')}${message.link}` : ''
  return [message.title, message.body, link].filter(Boolean).join('\n')
}
