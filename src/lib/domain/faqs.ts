export interface FaqItem {
  q: string
  a: string
}

export const faqs: readonly FaqItem[] = [
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
] as const
