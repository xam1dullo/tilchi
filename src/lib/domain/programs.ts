export type ProgramIconId = 'kids' | 'ielts' | 'adults'

export interface ProgramItem {
  iconId: ProgramIconId
  age: string
  title: string
  desc: string
  items: readonly string[]
}

export const programs: readonly ProgramItem[] = [
  {
    iconId: 'kids',
    age: '5–14 yosh',
    title: 'Bolalar',
    desc: "O'yin va interaktiv topshiriqlar orqali — bola zerikmasdan, o'zi qiziqib o'rganadi.",
    items: ["Yoshga mos o'yin-metodika", 'Har oy ota-onaga hisobot', "Ota-ona darsni kuzatishi mumkin"],
  },
  {
    iconId: 'ielts',
    age: 'Test tayyorgarligi',
    title: 'IELTS',
    desc: "Band-descriptor asosida tayyorgarlik — har bir modul bo'yicha aniq, o'lchanadigan reja.",
    items: ['Writing — har inshoga yozma feedback', 'Speaking — imtihon formatida', 'Muntazam mock testlar'],
  },
  {
    iconId: 'adults',
    age: '18+ yosh',
    title: 'Kattalar',
    desc: "Karyera, safar va kundalik muloqot uchun — grammatikadan ko'ra gapirishga urg'u.",
    items: ['Speaking-first metodika', "Ish jadvaliga mos vaqtlar", 'Real hayotiy mavzular'],
  },
] as const
