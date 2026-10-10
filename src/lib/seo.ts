import type { Post } from '@velite/index'
import { faqs } from '@/lib/domain/faqs'
import { courses, site, teacher } from '@/lib/site'

const workload = (perWeek: number) => `PT${(perWeek * site.lesson.durationMin) / 60}H`

export const graphLd = (...nodes: object[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
})

export const orgLd = {
  '@type': 'EducationalOrganization',
  '@id': `${site.url}/#org`,
  name: site.name,
  url: `${site.url}/`,
  description: site.orgDescription,
  areaServed: { '@type': 'Country', name: site.areaServed },
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
  name: courses.ielts.name,
  description: courses.ielts.description,
  inLanguage: 'uz',
  provider: { '@id': `${site.url}/#org` },
  hasCourseInstance: {
    '@type': 'CourseInstance',
    courseMode: 'online',
    courseWorkload: workload(site.lesson.ieltsPerWeek),
    instructor: { '@id': `${site.url}/#teacher` },
  },
}

export const groupCourseLd = {
  '@type': 'Course',
  name: courses.group.name,
  description: courses.group.description,
  inLanguage: 'uz',
  provider: { '@id': `${site.url}/#org` },
  hasCourseInstance: {
    '@type': 'CourseInstance',
    courseMode: 'online',
    courseWorkload: workload(site.lesson.groupPerWeek),
    instructor: { '@id': `${site.url}/#teacher` },
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
