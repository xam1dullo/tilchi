export interface TrustItem {
  dt: string
  dd: string
  num?: boolean
}

export const trustItems: readonly TrustItem[] = [
  { dt: 'Bepul', dd: "Birinchi demo dars. Karta ham, oldindan to'lov ham so'ralmaydi." },
  { dt: '5', dd: "Guruhdagi maksimal o'rin — yakka o'qituvchining haqiqiy sig'imi.", num: true },
  { dt: '12 soat', dd: "Shuncha oldin ogohlantirsangiz, dars bepul ko'chiriladi." },
  { dt: 'Shartnomasiz', dd: "Oylik to'lov. Istagan oyda to'xtatasiz, jarima yo'q." },
] as const
