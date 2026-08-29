export const site = {
  url: 'https://tilchi.uz',
  name: 'Tilchi',
  title: "Tilchi — IELTS 7.0 (C1) o'qituvchi bilan online ingliz tili | Birinchi dars bepul",
  description:
    "Mukhtasar Karimjonova — IELTS 7.0, C1 daraja, ilmiy tadqiqot muallifi. Bolalar, IELTS va kattalar uchun online ingliz tili darslari. Birinchi demo dars bepul, karta so'ralmaydi.",
  locale: 'uz_UZ',
  themeColor: '#F5EFE4',
  telegramBot: 'tilchiuz_bot',
  botUrl: 'https://t.me/tilchiuz_bot',
  nav: [
    { href: '/#programs', label: 'Dastur' },
    { href: '/teacher', label: "O'qituvchi" },
    { href: '/#pricing', label: 'Narx' },
    { href: '/#faq', label: 'Savollar' },
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
  jobTitle: "Ingliz tili o'qituvchisi · tilshunos-pedagog-tadqiqotchi",
  ielts: '7.0',
  cefr: 'C1',
  degree: "Magistratura bitiruvchisi · bakalavr (imtiyozli diplom)",
  experience: '6+ yil',
  summary:
    "Ingliz tili o'qituvchisi, IELTS Speaking Examiner va pragmatika yo'nalishida tadqiqot olib borayotgan tilshunos-pedagog.",
  research: "Pragmatik niyatlar va alluziyalar yo'nalishida ilmiy tadqiqot muallifi",
  education: [
    {
      degree: 'Magistr: Lingvistika (ingliz tili)',
      org: 'OʻzDJTU — Uzbekistan State World Languages University',
      period: '9-sentabr 2024 — 8-iyul 2026',
      detail: 'GPA: 5.0 (100%) · QS reytingida #251–300 toifasidagi universitet',
    },
    {
      degree: 'Bakalavr: Xorijiy til va adabiyoti (ingliz tili)',
      org: 'OʻzDJTU — Uzbekistan State World Languages University',
      period: '2-sentabr 2020 — 15-iyul 2024',
      detail: 'GPA: 4.92/5.0 (98%) · imtiyozli diplom',
    },
    {
      degree: 'Touragent mutaxassisligi · ingliz tili',
      org: 'Namangan davlat universiteti Akademik litseyi №1',
      period: '4-sentabr 2018 — 14-iyun 2020',
      detail: 'Imtiyozli diplom',
    },
    {
      degree: 'Maktab taʼlimi',
      org: 'Namangan viloyati, Uychi tumani, 38-maktab',
      period: '3-sentabr 2009 — 25-may 2018',
      detail: 'Eng yaxshi bitiruvchi',
    },
  ],
  training: [
    {
      title: 'Full-Stack Web Developer · Node.js va React.js',
      org: "Najot Ta'lim",
      period: '21-aprel 2025 — 9-may 2026',
    },
  ],
  workHistory: [
    { role: 'Koʻngilli oʻqituvchi', org: 'OʻzDJTU magistratura boʻlimi', period: '8-sentabr 2025 — 27-mart 2026', detail: 'Talabalar bilan ishlash amaliyoti' },
    { role: 'IELTS Instructor va Speaking Examiner', org: 'Everest LC, Toshkent', period: '22-noyabr 2023 — 8-yanvar 2025', detail: 'Speaking koʻnikmasi boʻyicha maxsus instruktor' },
    { role: "Boshlangʻich sinf o'qituvchisi (ko'ngilli)", org: 'Al-Beruniy International Private School', period: '3-sentabr — 3-dekabr 2023' },
    { role: "Ingliz tili o'qituvchisi / yordamchisi", org: 'Registan LC, Toshkent', period: '11-oktabr 2021 — 5-yanvar 2023', detail: '60+ oʻquvchining CEFR va IELTS natijalariga tayyorgarligi' },
    { role: "Ingliz tili o'qituvchisi (ko'ngilli amaliyotchi)", org: 'Toshkent shahar 147-sonli xorijiy tillarga ixtisoslashgan maktab', period: '1-mart — 1-may 2022' },
    { role: "Grammatika va speaking murabbiysi (ko'ngilli)", org: 'NamDU Akademik litseyi №1, Namangan', period: '1-dekabr 2019 — 1-aprel 2020' },
  ],
  researchWork: {
    title: 'How to Teach and Improve Academic Writing Skills through Critical Thinking Strategies',
    venue: "“Critical and creative thinking in language education” ilmiy to'plami, OʻzDJTU, 2022, p. 171",
    date: '2022-05-20',
    focus: "Pragmatik niyatlar va alluziyalar bo'yicha magistrlik tadqiqoti",
  },
  publications: [
    {
      title: 'The linguistic notion of pragmatic intentions: Theories of intention in communication',
      citation: 'Karimjonova, M. & Fayzullayeva, M. · The Lingua Spectrum, 5(1), 23–31 (2025)',
      href: 'https://lingvospektr.uz/index.php/lngsp/article/view/807',
    },
    {
      title: 'Allusion as a pragmatic device in “An unfinished story”',
      citation: 'Karimjonova, M. & Fayzullayeva, M. · Research and Implementation Journal (23-may 2026)',
      href: 'https://rai-journal.uz/index.php/rai/article/view/1587',
    },
    {
      title: 'Analysis of pragmatic intentions represented through allusions in “The Girl and the Habit”',
      citation: 'Karimjonova, M. & Fayzullayeva, M. · Research and Implementation Journal (2026)',
      href: 'https://rai-journal.uz/index.php/rai/article/view/1588',
    },
    {
      title: 'Representation and interpretation of pragmatic intentions in allusions',
      citation: 'Karimjonova, M. · Zenodo (21-mart 2026)',
      href: 'https://doi.org/10.5281/zenodo.19152269',
    },
    {
      title: 'Allusion in the spotlight of linguistic sciences: Pragmatics and discourse analysis',
      citation: 'Karimjonova, M. · Zenodo (21-mart 2026)',
      href: 'https://doi.org/10.5281/zenodo.19152283',
    },
    {
      title: 'Critical and creative thinking in language education',
      citation: 'English Faculty 2, OʻzDJTU, 2022, 171-bet · bosma ilmiy toʻplam',
    },
  ],
  languageSkills: [
    { language: "O'zbek tili", level: 'Ona tili' },
    { language: 'English', level: 'C1 · Listening C1 · Reading C1 · Writing B2 · Speaking C1' },
    { language: 'Arabic', level: "O'rganmoqda" },
    { language: 'Japanese', level: "O'rganmoqda" },
    { language: 'Russian', level: "O'rganmoqda" },
  ],
  interests: 'Kitob o‘qish va tillarni o‘rganish: arab, yapon va rus tillari.',
  awards: [
    { title: '“Best Speech Performance” sertifikati', org: 'II Respublika konferensiyasi, Yeouju Technical Institute', period: '2022' },
    { title: "Certificate of Attendance — 20 soatlik General English kursi", org: 'Norwich Institute for Language Education (NILE), CELTA kursantlari', period: '2021' },
  ],
  certifications: [
    { title: 'Multilevel CEFR English C1', detail: '№ 26BBA1767401KM', period: '18-iyun 2026' },
    { title: "Najot Ta'lim Bootcamp · Full Stack Node.js + React.js", detail: '№ 0071112026831415', period: '9-may 2026' },
    { title: 'IELTS Academic 7.0', detail: 'TRF № 24UZ009120KARM025A', period: '17-avgust 2024' },
    { title: 'IELTS Academic 7.0', detail: 'TRF № 23UZ009546KARM025A', period: '10-avgust 2023' },
  ],
} as const

export const prices = {
  group: { regular: 250_000, launch: 180_000 },
  indiv: { regular: 450_000, launch: 330_000 },
  ieltsAddon: 150_000,
} as const

export const fmtPrice = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')

export const segments = [
  { value: 'bolalar', label: 'Bolalar' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'kattalar', label: 'Kattalar' },
] as const

export const levels = [
  { value: 'boshlovchi', label: 'Boshlovchi' },
  { value: 'orta', label: "O'rta" },
  { value: 'bilmayman', label: 'Bilmayman' },
] as const

export const botSummary = (seg: string, lv: string) => {
  const s = segments.find((x) => x.value === seg)?.label
  const l = levels.find((x) => x.value === lv)?.label
  return [s, l].filter(Boolean).join(' · ')
}

export const tgLinkProps = (href: string = site.botUrl) =>
  ({ href, target: '_blank', rel: 'noopener' }) as const

export const botLink = (seg: string, lv: string) => {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '')
  const segC = clean(seg)
  const lvC = clean(lv)
  const payload = segC || lvC ? [segC, lvC].filter(Boolean).join('_').slice(0, 64) : ''
  return payload ? `${site.botUrl}?start=${payload}` : site.botUrl
}
