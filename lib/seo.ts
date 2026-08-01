import type { Post } from '@velite/index'
import { site, teacher } from '@/lib/site'

export const graphLd = (...nodes: object[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
})

export const orgLd = {
  '@type': 'EducationalOrganization',
  '@id': `${site.url}/#org`,
  name: 'Tilchi',
  url: `${site.url}/`,
  description: 'Online ingliz tili darslari — bolalar, IELTS va kattalar uchun.',
  areaServed: { '@type': 'Country', name: 'Uzbekistan' },
  inLanguage: 'uz',
}

export const teacherLd = {
  '@type': 'Person',
  '@id': `${site.url}/#teacher`,
  name: teacher.name,
  jobTitle: teacher.jobTitle,
  worksFor: { '@id': `${site.url}/#org` },
  hasCredential: [
    { '@type': 'EducationalOccupationalCredential', name: teacher.cert, credentialCategory: 'certificate' },
    { '@type': 'EducationalOccupationalCredential', name: `IELTS ${teacher.ielts}`, credentialCategory: 'certificate' },
  ],
  knowsLanguage: [
    { '@type': 'Language', name: 'English', alternateName: 'en' },
    { '@type': 'Language', name: 'Uzbek', alternateName: 'uz' },
  ],
}

export const ieltsCourseLd = {
  '@type': 'Course',
  name: 'IELTS tayyorgarlik — online',
  description:
    "Band-descriptor asosida IELTS tayyorgarligi: Writing bo'yicha yozma feedback, Speaking imtihon formatida, muntazam mock testlar.",
  inLanguage: 'uz',
  provider: { '@id': `${site.url}/#org` },
  hasCourseInstance: {
    '@type': 'CourseInstance',
    courseMode: 'online',
    courseWorkload: 'PT3H',
    instructor: { '@id': `${site.url}/#teacher` },
  },
  offers: {
    '@type': 'Offer',
    category: 'Individual',
    price: '330000',
    priceCurrency: 'UZS',
    availability: 'https://schema.org/LimitedAvailability',
  },
}

export const groupCourseLd = {
  '@type': 'Course',
  name: 'Ingliz tili — guruh darslari',
  description: '3–5 kishilik kichik guruhda haftada 3 dars. Uy vazifasi tekshiriladi, har darsda speaking mashqlari.',
  inLanguage: 'uz',
  provider: { '@id': `${site.url}/#org` },
  hasCourseInstance: {
    '@type': 'CourseInstance',
    courseMode: 'online',
    courseWorkload: 'PT3H',
    instructor: { '@id': `${site.url}/#teacher` },
  },
  offers: {
    '@type': 'Offer',
    category: 'Guruh',
    price: '180000',
    priceCurrency: 'UZS',
    availability: 'https://schema.org/LimitedAvailability',
  },
}

export const faqLd = {
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: "Darslar qayerda o'tadi?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Barcha darslar Zoom orqali online. Dars oldidan havola Telegram'da yuboriladi. Kamera va mikrofon kerak bo'ladi.",
      },
    },
    {
      '@type': 'Question',
      name: 'Bepul demo dars nima o‘z ichiga oladi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "30 daqiqalik jonli suhbat: darajangiz aniqlanadi, maqsadingiz muhokama qilinadi va sizga mos dastur taklif etiladi. Hech qanday to'lov yoki karta so'ralmaydi.",
      },
    },
    {
      '@type': 'Question',
      name: 'Nega narxlar launch deb belgilangan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Biz yangi boshlayapmiz — sharh va natijalar hali yig'ilmoqda. Shuning uchun birinchi oqim o'quvchilariga past narx taklif qilamiz. Keyingi oqimlarda narx oddiy tarifga qaytadi.",
      },
    },
    {
      '@type': 'Question',
      name: "To'lov qanday amalga oshiriladi?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Oylik to'lov, Uzcard yoki Humo karta o'tkazmasi orqali. To'lov faqat demo darsdan keyin, davom etishga qaror qilsangiz.",
      },
    },
    {
      '@type': 'Question',
      name: "Darsni o'tkazib yuborsam nima bo'ladi?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Kamida 12 soat oldin ogohlantirsangiz — dars boshqa vaqtga bepul ko'chiriladi. Individual formatda jadval umuman moslashuvchan.",
      },
    },
    {
      '@type': 'Question',
      name: "Bola darsda yolg'iz bo'ladimi?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Xohishga ko'ra ota-ona darsni kuzatishi mumkin. Har oy bolangizning progressi haqida qisqa hisobot yuboriladi.",
      },
    },
  ],
}

export const articleLd = (post: Post) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.description,
  datePublished: post.date,
  inLanguage: 'uz',
  author: { '@id': `${site.url}/#teacher` },
  publisher: { '@id': `${site.url}/#org` },
  mainEntityOfPage: `${site.url}${post.href}/`,
})
