import type { Post } from '@velite/index'
import { faqs } from '@/lib/domain/faqs'
import { site, teacher, prices } from '@/lib/site'

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
    { '@type': 'EducationalOccupationalCredential', name: `IELTS ${teacher.ielts}`, credentialCategory: 'certificate' },
    { '@type': 'EducationalOccupationalCredential', name: `CEFR ${teacher.cefr}`, credentialCategory: 'certificate' },
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
    price: String(prices.indiv.launch),
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
    price: String(prices.group.launch),
    priceCurrency: 'UZS',
    availability: 'https://schema.org/LimitedAvailability',
  },
}

export const faqLd = {
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
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
