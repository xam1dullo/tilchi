export interface DemoStep {
  n: string
  title: string
  desc: string
}

export const demoSteps: readonly DemoStep[] = [
  { n: '1', title: 'Qisqa tanishuv', desc: "Nima uchun ingliz tili kerakligini so'raymiz — imtihon, ish, safar yoki bola uchunmi." },
  { n: '2', title: 'Daraja aniqlanadi', desc: "Jonli suhbat orqali CEFR bo'yicha taxminiy darajangiz belgilanadi. Test to'ldirmaysiz." },
  { n: '3', title: 'Haqiqiy mashq', desc: "Bir necha daqiqa real dars formatida ishlaymiz — uslub sizga to'g'ri kelishini ko'rasiz." },
  { n: '4', title: 'Reja va narx', desc: "Sizga mos format, haftalik jadval va aniq oylik summa aytiladi. Yashirin to'lov yo'q." },
] as const
