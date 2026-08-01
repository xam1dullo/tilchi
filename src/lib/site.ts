export const site = {
  url: 'https://tilchi.uz',
  name: 'Tilchi',
  title: "Tilchi — CELTA sertifikatli o'qituvchi bilan online ingliz tili | Birinchi dars bepul",
  description:
    "Mukhtasar Karimjonova — CELTA sertifikatli, IELTS 7.0, C1 daraja. Bolalar, IELTS va kattalar uchun online ingliz tili darslari. Birinchi demo dars bepul, karta so'ralmaydi.",
  locale: 'uz_UZ',
  themeColor: '#F5EFE4',
  telegramBot: 'tilchiuz_bot',
  botUrl: 'https://t.me/tilchiuz_bot',
  nav: [
    { href: '#dastur', label: 'Dastur' },
    { href: '#oqituvchi', label: "O'qituvchi" },
    { href: '#narx', label: 'Narx' },
    { href: '#faq', label: 'Savollar' },
    { href: '/blog', label: 'Blog' },
  ],
  cohort: {
    label: 'Birinchi oqim — 2026-yil avgust',
    groupSeats: 5,
  },
  lesson: { durationMin: 60, groupPerWeek: 3, indivPerWeek: 2 },
} as const

export const teacher = {
  name: 'Mukhtasar Karimjonova',
  initials: 'MK',
  jobTitle: "Ingliz tili o'qituvchisi",
  ielts: '7.0',
  cert: 'CELTA',
  cefr: 'C1',
  degree: 'Bakalavr + Magistr (imtiyozli diplom)',
  experience: '2+ yil',
  research: "Pragmatika yo'nalishida ilmiy tadqiqot muallifi",
  education: [
    { degree: 'Magistr: Lingvistika (ingliz tili)', org: 'OʻzDJTU — UzSWLU', period: '2024 — hozirgacha' },
    { degree: 'Bakalavr: Xorijiy til va adabiyoti (ingliz tili)', org: 'OʻzDJTU — UzSWLU', period: '2020 — 2024' },
    { degree: 'Imtiyozli diplom, 98% (4.92/5.0)', org: 'OʻzDJTU — UzSWLU', period: '' },
  ],
  workHistory: [
    { role: 'IELTS Instructor va Speaking Examiner', org: 'Everest LC, Toshkent', period: '2023 — 2025' },
    { role: "Boshlangʻich sinf o'qituvchisi (ko'ngilli)", org: 'Al-Beruniy International Private School', period: '2023' },
    { role: "Ingliz tili o'qituvchisi yordamchisi", org: 'Registan LC, Toshkent', period: '2021 — 2023' },
    { role: "Grammatika va speaking murabbiysi (ko'ngilli)", org: 'NamDU Akademik litseyi №1, Namangan', period: '2019 — 2020' },
  ],
  researchWork: {
    title: 'How to Teach and Improve Academic Writing Skills through Critical Thinking Strategies',
    venue: "“Critical and creative thinking in language education” ilmiy to'plami, OʻzDJTU, 2022, p. 171",
    date: '2022-05-20',
    focus: "Pragmatika yo'nalishidagi magistrlik tadqiqoti — davom etmoqda",
  },
  awards: [
    { title: '“Best Speech Performance” sertifikati', org: 'II Respublika konferensiyasi, Yeouju Technical Institute', period: '2022' },
    { title: "Certificate of Attendance — 20 soatlik General English kursi", org: 'Norwich Institute for Language Education (NILE), CELTA kursantlari', period: '2021' },
  ],
} as const

export const prices = {
  group: { regular: 250_000, launch: 180_000 },
  indiv: { regular: 450_000, launch: 330_000 },
  ieltsAddon: 150_000,
} as const

export const fmtPrice = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')

export const botLink = (seg: string, lv: string) => {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '')
  const segC = clean(seg)
  const lvC = clean(lv)
  const payload = segC || lvC ? [segC, lvC].filter(Boolean).join('_').slice(0, 64) : ''
  return payload ? `${site.botUrl}?start=${payload}` : site.botUrl
}
