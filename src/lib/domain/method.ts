import { site } from '@/lib/site'

export interface MethodStep {
  n: string
  title: string
  desc: string
  time: string
}

export const methodSteps: readonly MethodStep[] = [
  {
    n: '01',
    title: "Telegram'da yoziling",
    desc: "Pastdagi tugma orqali botga o'tasiz — segment va darajangizni tanlaysiz, bot qolganini so'raydi.",
    time: '~2 daqiqa',
  },
  {
    n: '02',
    title: 'Bepul demo dars',
    desc: "O'qituvchi bilan tanishasiz, darajangiz aniqlanadi va sizga mos reja tuziladi. Majburiyatsiz.",
    time: '30 daqiqa · Zoom',
  },
  {
    n: '03',
    title: 'Darslar boshlanadi',
    desc: "Guruh yoki individual formatni tanlaysiz — jadval sizning vaqtingizga moslanadi.",
    time: site.cohort.label,
  },
] as const
