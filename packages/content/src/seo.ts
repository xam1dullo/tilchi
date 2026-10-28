import { type ContentLocale, landing } from './landing'
import { site, teacher } from './site'

const workload = (perWeek: number) =>
  `PT${(perWeek * site.lesson.durationMin) / 60}H`
const perWeek = {
  group: site.lesson.groupPerWeek,
  ielts: site.lesson.ieltsPerWeek,
}

/** JSON-LD graph (Organization + Person + Course) built from the landing copy. */
export function landingJsonLd(locale: ContentLocale) {
  const copy = landing[locale]
  const org = `${site.url}/#org`
  const person = `${site.url}/#teacher`
  const credential = (name: string) => ({
    '@type': 'EducationalOccupationalCredential',
    name,
    credentialCategory: 'certificate',
  })
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': org,
        name: site.name,
        url: `${site.url}/`,
        description: copy.meta.description,
        areaServed: { '@type': 'Country', name: site.areaServed },
        inLanguage: locale,
      },
      {
        '@type': 'Person',
        '@id': person,
        name: teacher.name,
        jobTitle: copy.teacher.role,
        worksFor: { '@id': org },
        hasCredential: [
          credential(`IELTS ${teacher.ielts}`),
          credential(`CEFR ${teacher.cefr}`),
        ],
      },
      ...copy.courses.items.map((course) => ({
        '@type': 'Course',
        name: course.name,
        description: course.desc,
        inLanguage: locale,
        provider: { '@id': org },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'online',
          courseWorkload: workload(perWeek[course.id]),
          instructor: { '@id': person },
        },
      })),
    ],
  }
}
