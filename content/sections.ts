import { site } from '@/lib/site'

export type ProgramIcon = 'bolalar' | 'ielts' | 'kattalar'

export interface TrustItem {
  dt: string
  dd: string
  num?: boolean
}

export const trustItems: TrustItem[] = [
  { dt: 'Bepul', dd: "Birinchi demo dars. Karta ham, oldindan to'lov ham so'ralmaydi." },
  { dt: '5', dd: "Guruhdagi maksimal o'rin — yakka o'qituvchining haqiqiy sig'imi.", num: true },
  { dt: '12 soat', dd: "Shuncha oldin ogohlantirsangiz, dars bepul ko'chiriladi." },
  { dt: 'Shartnomasiz', dd: "Oylik to'lov. Istagan oyda to'xtatasiz, jarima yo'q." },
]

export interface DemoStep {
  n: string
  title: string
  desc: string
}

export const demoSteps: DemoStep[] = [
  { n: '1', title: 'Qisqa tanishuv', desc: "Nima uchun ingliz tili kerakligini so'raymiz — imtihon, ish, safar yoki bola uchunmi." },
  { n: '2', title: 'Daraja aniqlanadi', desc: "Jonli suhbat orqali CEFR bo'yicha taxminiy darajangiz belgilanadi. Test to'ldirmaysiz." },
  { n: '3', title: 'Haqiqiy mashq', desc: "Bir necha daqiqa real dars formatida ishlaymiz — uslub sizga to'g'ri kelishini ko'rasiz." },
  { n: '4', title: 'Reja va narx', desc: "Sizga mos format, haftalik jadval va aniq oylik summa aytiladi. Yashirin to'lov yo'q." },
]

export interface MethodStep {
  n: string
  title: string
  desc: string
  time: string
}

export const methodSteps: MethodStep[] = [
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
]

export interface FaqItem {
  q: string
  a: string
}

export const faqs: FaqItem[] = [
  {
    q: "Darslar qayerda o'tadi?",
    a: "Barcha darslar Zoom orqali online. Dars oldidan havola Telegram'da yuboriladi. Kamera va mikrofon kerak bo'ladi.",
  },
  {
    q: 'Bepul demo dars nima o‘z ichiga oladi?',
    a: "30 daqiqalik jonli suhbat: darajangiz aniqlanadi, maqsadingiz muhokama qilinadi va sizga mos dastur taklif etiladi. Hech qanday to'lov yoki karta so'ralmaydi.",
  },
  {
    q: 'Nega narxlar "launch" deb belgilangan?',
    a: "Biz yangi boshlayapmiz — sharh va natijalar hali yig'ilmoqda. Shuning uchun birinchi oqim o'quvchilariga past narx taklif qilamiz: siz kam to'laysiz, biz esa birinchi natijalarimizni siz bilan quramiz. Keyingi oqimlarda narx oddiy tarifga qaytadi.",
  },
  {
    q: "To'lov qanday amalga oshiriladi?",
    a: "Oylik to'lov, Uzcard yoki Humo karta o'tkazmasi orqali. To'lov faqat demo darsdan keyin, davom etishga qaror qilsangiz.",
  },
  {
    q: "Darsni o'tkazib yuborsam nima bo'ladi?",
    a: "Kamida 12 soat oldin ogohlantirsangiz — dars boshqa vaqtga bepul ko'chiriladi. Individual formatda jadval umuman moslashuvchan.",
  },
  {
    q: "Bola darsda yolg'iz bo'ladimi?",
    a: "Xohishga ko'ra ota-ona darsni kuzatishi mumkin. Har oy bolangizning progressi haqida qisqa hisobot yuboriladi.",
  },
]

export interface Program {
  icon: ProgramIcon
  age: string
  title: string
  desc: string
  items: string[]
}

export const programs: Program[] = [
  {
    icon: 'bolalar',
    age: '5–14 yosh',
    title: 'Bolalar',
    desc: "O'yin va interaktiv topshiriqlar orqali — bola zerikmasdan, o'zi qiziqib o'rganadi.",
    items: ["Yoshga mos o'yin-metodika", 'Har oy ota-onaga hisobot', "Ota-ona darsni kuzatishi mumkin"],
  },
  {
    icon: 'ielts',
    age: 'Test tayyorgarligi',
    title: 'IELTS',
    desc: "Band-descriptor asosida tayyorgarlik — har bir modul bo'yicha aniq, o'lchanadigan reja.",
    items: ['Writing — har inshoga yozma feedback', 'Speaking — imtihon formatida', 'Muntazam mock testlar'],
  },
  {
    icon: 'kattalar',
    age: '18+ yosh',
    title: 'Kattalar',
    desc: "Karyera, safar va kundalik muloqot uchun — grammatikadan ko'ra gapirishga urg'u.",
    items: ['Speaking-first metodika', "Ish jadvaliga mos vaqtlar", 'Real hayotiy mavzular'],
  },
]
