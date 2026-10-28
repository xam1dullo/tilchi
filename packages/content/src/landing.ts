import { faqs as uzFaqs } from './domain/faqs'
import { methodSteps as uzSteps } from './domain/method'
import { programs as uzPrograms } from './domain/programs'
import { trustItems as uzTrust } from './domain/trust'
import { botLink, site, teacher } from './site'

export const contentLocales = ['uz', 'ru', 'en'] as const
export type ContentLocale = (typeof contentLocales)[number]

export const segmentIds = ['bolalar', 'ielts', 'kattalar'] as const
export const levelIds = ['boshlovchi', 'orta', 'bilmayman'] as const
export type SegmentId = (typeof segmentIds)[number]
export type LevelId = (typeof levelIds)[number]

/** Decision G2: the bot parses `<segment>_<level>`. */
export const ctaPayload = (seg: SegmentId, lv: LevelId) => `${seg}_${lv}`
export const ctaHref = (seg?: SegmentId, lv?: LevelId) =>
  seg && lv ? botLink(seg, lv) : botLink('', '')

export interface Card {
  segment: SegmentId
  age: string
  title: string
  desc: string
  items: readonly string[]
}
export interface Course {
  id: 'group' | 'ielts'
  segments: readonly SegmentId[]
  name: string
  desc: string
  facts: readonly string[]
}
export interface Landing {
  meta: { title: string; description: string; ogLocale: string }
  nav: { programs: string; teacher: string; faq: string }
  hero: {
    eyebrow: string
    before: string
    em: string
    after: string
    lede: string
    cta: string
    facts: readonly string[]
  }
  trust: readonly { dt: string; dd: string }[]
  segments: {
    eyebrow: string
    title: string
    cta: string
    cards: readonly Card[]
  }
  teacher: {
    eyebrow: string
    title: string
    role: string
    summary: string
    research: string
    facts: readonly { k: string; v: string }[]
  }
  method: {
    eyebrow: string
    title: string
    steps: readonly { n: string; title: string; desc: string; time: string }[]
  }
  courses: {
    eyebrow: string
    title: string
    price: string
    levelsLabel: string
    items: readonly Course[]
  }
  faq: {
    eyebrow: string
    title: string
    items: readonly { q: string; a: string }[]
  }
  cta: { title: string; body: string; button: string }
  foot: { tagline: string }
  segmentLabels: Record<SegmentId, string>
  levelLabels: Record<LevelId, string>
}

const perWeek = site.lesson.groupPerWeek
const min = site.lesson.durationMin

// ponytail: uz reuses the legacy domain arrays; the stale "launch price" FAQ is dropped (prices hidden).
const uz: Landing = {
  meta: { title: site.title, description: site.description, ogLocale: 'uz_UZ' },
  nav: { programs: 'Kurslar', teacher: "O'qituvchi", faq: 'Savollar' },
  hero: {
    eyebrow: 'Online ingliz tili',
    before: 'Ingliz tilini ',
    em: "to'g'ri",
    after: " o'qituvchi bilan o'rganing.",
    lede: site.orgDescription,
    cta: "Telegram'da davom etish",
    facts: [
      `IELTS ${teacher.ielts}`,
      `CEFR ${teacher.cefr}`,
      'Birinchi dars bepul',
    ],
  },
  trust: uzTrust,
  segments: {
    eyebrow: 'Kim uchun',
    title: "Sizga mos yo'nalishni tanlang",
    cta: 'Boshlash',
    cards: uzPrograms.map((p, i) => ({
      segment: segmentIds[i] as SegmentId,
      age: p.age,
      title: p.title,
      desc: p.desc,
      items: p.items,
    })),
  },
  teacher: {
    eyebrow: "O'qituvchi",
    title: teacher.name,
    role: teacher.jobTitle,
    summary: teacher.summary,
    research: teacher.research,
    facts: [
      { k: 'IELTS', v: teacher.ielts },
      { k: 'CEFR', v: teacher.cefr },
      { k: 'Tajriba', v: teacher.experience },
    ],
  },
  method: {
    eyebrow: 'Qanday boshlanadi',
    title: 'Uch qadam',
    steps: uzSteps,
  },
  courses: {
    eyebrow: 'Kurslar',
    title: "Daraja va yo'nalish bo'yicha",
    price: 'Narx: kelishuv asosida',
    levelsLabel: 'Darajangiz',
    items: [
      {
        id: 'group',
        segments: ['bolalar', 'kattalar'],
        name: 'Ingliz tili — guruh darslari',
        desc: `${site.cohort.groupMin}–${site.cohort.groupSeats} kishilik kichik guruhda haftada ${perWeek} dars. Uy vazifasi tekshiriladi, har darsda speaking mashqlari.`,
        facts: [`${min} daqiqa`, `haftada ${perWeek} dars`, 'Zoom'],
      },
      {
        id: 'ielts',
        segments: ['ielts'],
        name: 'IELTS tayyorgarlik — online',
        desc: "Band-descriptor asosida tayyorgarlik: Writing bo'yicha yozma feedback, Speaking imtihon formatida, muntazam mock testlar.",
        facts: [
          `${min} daqiqa`,
          `haftada ${site.lesson.ieltsPerWeek} dars`,
          'Mock testlar',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'Savollar',
    title: "Ko'p so'raladigan savollar",
    items: uzFaqs.filter((f) => !f.q.includes('launch')),
  },
  cta: {
    title: 'Birinchi dars bepul',
    body: "Telegram'da yozing — segment va darajangizni tanlaysiz, qolganini bot so'raydi. Karta kerak emas.",
    button: "Telegram'da yozish",
  },
  foot: { tagline: 'Mukhtasar Karimjonova bilan online ingliz tili' },
  segmentLabels: { bolalar: 'Bolalar', ielts: 'IELTS', kattalar: 'Kattalar' },
  levelLabels: {
    boshlovchi: 'Boshlovchi',
    orta: "O'rta",
    bilmayman: 'Bilmayman',
  },
}

const ru: Landing = {
  meta: {
    title:
      'Tilchi — онлайн-английский с преподавателем IELTS 7.0 (C1) | Первый урок бесплатно',
    description:
      'Мухтасар Каримжонова — IELTS 7.0, уровень C1, автор научных работ. Онлайн-английский для детей, подготовка к IELTS и курсы для взрослых. Первый пробный урок бесплатно, карта не нужна.',
    ogLocale: 'ru_RU',
  },
  nav: { programs: 'Курсы', teacher: 'Преподаватель', faq: 'Вопросы' },
  hero: {
    eyebrow: 'Английский онлайн',
    before: 'Учите английский с ',
    em: 'правильным',
    after: ' преподавателем.',
    lede: 'Онлайн-уроки английского для детей, подготовка к IELTS и курсы для взрослых.',
    cta: 'Продолжить в Telegram',
    facts: [
      `IELTS ${teacher.ielts}`,
      `CEFR ${teacher.cefr}`,
      'Первый урок бесплатно',
    ],
  },
  trust: [
    { dt: 'Бесплатно', dd: 'Первый пробный урок. Ни карты, ни предоплаты.' },
    {
      dt: '5',
      dd: 'Максимум мест в группе — реальная вместимость одного преподавателя.',
    },
    {
      dt: '12 часов',
      dd: 'Предупредите за это время — урок бесплатно перенесём.',
    },
    {
      dt: 'Без договора',
      dd: 'Оплата помесячно. Остановитесь в любой месяц, без штрафов.',
    },
  ],
  segments: {
    eyebrow: 'Для кого',
    title: 'Выберите своё направление',
    cta: 'Начать',
    cards: [
      {
        segment: 'bolalar',
        age: '5–14 лет',
        title: 'Дети',
        desc: 'Через игру и интерактивные задания — ребёнку интересно, он учится без скуки.',
        items: [
          'Игровая методика по возрасту',
          'Ежемесячный отчёт родителям',
          'Родитель может смотреть урок',
        ],
      },
      {
        segment: 'ielts',
        age: 'Подготовка к тесту',
        title: 'IELTS',
        desc: 'Подготовка по band-дескрипторам — чёткий измеримый план по каждому модулю.',
        items: [
          'Writing — письменный фидбек на каждое эссе',
          'Speaking — в формате экзамена',
          'Регулярные мок-тесты',
        ],
      },
      {
        segment: 'kattalar',
        age: '18+ лет',
        title: 'Взрослые',
        desc: 'Для карьеры, путешествий и общения — упор на разговор, а не на грамматику.',
        items: [
          'Методика speaking-first',
          'Время под ваш рабочий график',
          'Темы из реальной жизни',
        ],
      },
    ],
  },
  teacher: {
    eyebrow: 'Преподаватель',
    title: 'Мухтасар Каримжонова',
    role: 'Преподаватель английского · лингвист-педагог-исследователь',
    summary:
      'Преподаватель английского, IELTS Speaking Examiner и лингвист-педагог, ведущий исследования в области прагматики.',
    research: 'Автор научных работ о прагматических намерениях и аллюзиях',
    facts: [
      { k: 'IELTS', v: teacher.ielts },
      { k: 'CEFR', v: teacher.cefr },
      { k: 'Опыт', v: '6+ лет' },
    ],
  },
  method: {
    eyebrow: 'Как начать',
    title: 'Три шага',
    steps: [
      {
        n: '01',
        title: 'Напишите в Telegram',
        desc: 'Кнопка ниже ведёт к боту — выбираете направление и уровень, остальное бот спросит сам.',
        time: '~2 минуты',
      },
      {
        n: '02',
        title: 'Бесплатный пробный урок',
        desc: 'Знакомитесь с преподавателем, определяется уровень и составляется план. Без обязательств.',
        time: '30 минут · Zoom',
      },
      {
        n: '03',
        title: 'Начинаются занятия',
        desc: 'Выбираете группу или индивидуальный формат — расписание подстраивается под вас.',
        time: `${perWeek} урока в неделю`,
      },
    ],
  },
  courses: {
    eyebrow: 'Курсы',
    title: 'По уровню и направлению',
    price: 'Цена: по договорённости',
    levelsLabel: 'Ваш уровень',
    items: [
      {
        id: 'group',
        segments: ['bolalar', 'kattalar'],
        name: 'Английский — групповые занятия',
        desc: `Малая группа из ${site.cohort.groupMin}–${site.cohort.groupSeats} человек, ${perWeek} урока в неделю. Домашние задания проверяются, на каждом уроке — speaking-практика.`,
        facts: [`${min} минут`, `${perWeek} урока в неделю`, 'Zoom'],
      },
      {
        id: 'ielts',
        segments: ['ielts'],
        name: 'Подготовка к IELTS — онлайн',
        desc: 'Подготовка по band-дескрипторам: письменный фидбек по Writing, Speaking в формате экзамена, регулярные мок-тесты.',
        facts: [
          `${min} минут`,
          `${site.lesson.ieltsPerWeek} урока в неделю`,
          'Мок-тесты',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'Вопросы',
    title: 'Частые вопросы',
    items: [
      {
        q: 'Где проходят уроки?',
        a: 'Все уроки онлайн через Zoom. Ссылка приходит в Telegram перед занятием. Нужны камера и микрофон.',
      },
      {
        q: 'Что входит в бесплатный пробный урок?',
        a: '30 минут живого разговора: определяем уровень, обсуждаем цель и предлагаем подходящую программу. Оплата и карта не нужны.',
      },
      {
        q: 'Как проходит оплата?',
        a: 'Помесячно, переводом на карту Uzcard или Humo. Платить нужно только после пробного урока, если решите продолжить. Чек отправляете в Telegram — оплату подтверждаем и начинаем занятия.',
      },
      {
        q: 'Что если я пропущу урок?',
        a: 'Предупредите минимум за 12 часов — урок бесплатно перенесём. В индивидуальном формате расписание гибкое.',
      },
      {
        q: 'Ребёнок будет на уроке один?',
        a: 'По желанию родитель может наблюдать за уроком. Каждый месяц отправляем короткий отчёт о прогрессе.',
      },
    ],
  },
  cta: {
    title: 'Первый урок бесплатно',
    body: 'Напишите в Telegram — выберете направление и уровень, остальное спросит бот. Карта не нужна.',
    button: 'Написать в Telegram',
  },
  foot: { tagline: 'Английский онлайн с Мухтасар Каримжоновой' },
  segmentLabels: { bolalar: 'Дети', ielts: 'IELTS', kattalar: 'Взрослые' },
  levelLabels: {
    boshlovchi: 'Начальный',
    orta: 'Средний',
    bilmayman: 'Не знаю',
  },
}

const en: Landing = {
  meta: {
    title:
      'Tilchi — online English with an IELTS 7.0 (C1) teacher | First lesson free',
    description:
      'Mukhtasar Karimjonova — IELTS 7.0, CEFR C1, published researcher. Online English for kids, IELTS preparation and adults. The first demo lesson is free, no card needed.',
    ogLocale: 'en_US',
  },
  nav: { programs: 'Courses', teacher: 'Teacher', faq: 'FAQ' },
  hero: {
    eyebrow: 'Online English',
    before: 'Learn English with the ',
    em: 'right',
    after: ' teacher.',
    lede: 'Online English lessons for kids, IELTS preparation and courses for adults.',
    cta: 'Continue in Telegram',
    facts: [
      `IELTS ${teacher.ielts}`,
      `CEFR ${teacher.cefr}`,
      'First lesson free',
    ],
  },
  trust: [
    {
      dt: 'Free',
      dd: 'The first demo lesson. No card and no upfront payment.',
    },
    {
      dt: '5',
      dd: 'Seats per group at most — the real capacity of a single teacher.',
    },
    {
      dt: '12 hours',
      dd: 'Give this much notice and the lesson moves for free.',
    },
    { dt: 'No contract', dd: 'Pay monthly. Stop in any month, no penalty.' },
  ],
  segments: {
    eyebrow: 'Who it is for',
    title: 'Pick your track',
    cta: 'Get started',
    cards: [
      {
        segment: 'bolalar',
        age: 'Ages 5–14',
        title: 'Kids',
        desc: 'Games and interactive tasks — the child learns out of curiosity, not boredom.',
        items: [
          'Age-appropriate play method',
          'Monthly report to parents',
          'Parents can watch the lesson',
        ],
      },
      {
        segment: 'ielts',
        age: 'Test preparation',
        title: 'IELTS',
        desc: 'Band-descriptor based preparation — a clear, measurable plan for every module.',
        items: [
          'Writing — written feedback on every essay',
          'Speaking — in exam format',
          'Regular mock tests',
        ],
      },
      {
        segment: 'kattalar',
        age: 'Ages 18+',
        title: 'Adults',
        desc: 'For career, travel and everyday conversation — speaking first, grammar second.',
        items: [
          'Speaking-first method',
          'Times that fit your work schedule',
          'Real-life topics',
        ],
      },
    ],
  },
  teacher: {
    eyebrow: 'Teacher',
    title: teacher.name,
    role: 'English teacher · linguist, pedagogue and researcher',
    summary:
      'English teacher, IELTS Speaking Examiner and a linguist-pedagogue researching pragmatics.',
    research: 'Author of research on pragmatic intentions and allusions',
    facts: [
      { k: 'IELTS', v: teacher.ielts },
      { k: 'CEFR', v: teacher.cefr },
      { k: 'Experience', v: '6+ years' },
    ],
  },
  method: {
    eyebrow: 'How it starts',
    title: 'Three steps',
    steps: [
      {
        n: '01',
        title: 'Message us on Telegram',
        desc: 'The button below opens the bot — you pick a track and a level, the bot asks the rest.',
        time: '~2 minutes',
      },
      {
        n: '02',
        title: 'Free demo lesson',
        desc: 'You meet the teacher, your level is assessed and a plan is made. No commitment.',
        time: '30 minutes · Zoom',
      },
      {
        n: '03',
        title: 'Lessons begin',
        desc: 'Choose a group or individual format — the schedule adapts to your time.',
        time: `${perWeek} lessons a week`,
      },
    ],
  },
  courses: {
    eyebrow: 'Courses',
    title: 'By level and track',
    price: 'Price: by arrangement',
    levelsLabel: 'Your level',
    items: [
      {
        id: 'group',
        segments: ['bolalar', 'kattalar'],
        name: 'English — group lessons',
        desc: `A small group of ${site.cohort.groupMin}–${site.cohort.groupSeats} people, ${perWeek} lessons a week. Homework is checked, with speaking practice in every lesson.`,
        facts: [`${min} minutes`, `${perWeek} lessons a week`, 'Zoom'],
      },
      {
        id: 'ielts',
        segments: ['ielts'],
        name: 'IELTS preparation — online',
        desc: 'Band-descriptor based preparation: written Writing feedback, Speaking in exam format, regular mock tests.',
        facts: [
          `${min} minutes`,
          `${site.lesson.ieltsPerWeek} lessons a week`,
          'Mock tests',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Where do the lessons take place?',
        a: 'All lessons are online on Zoom. The link arrives in Telegram before the lesson. You need a camera and a microphone.',
      },
      {
        q: 'What does the free demo lesson include?',
        a: 'A 30-minute live conversation: we assess your level, discuss your goal and suggest a fitting programme. No payment or card.',
      },
      {
        q: 'How do I pay?',
        a: 'Monthly, by Uzcard or Humo card transfer. You pay only after the demo lesson, if you decide to continue. Send the receipt in Telegram — the payment is confirmed and lessons begin.',
      },
      {
        q: 'What if I miss a lesson?',
        a: 'Give at least 12 hours notice and the lesson moves for free. In the individual format the schedule is flexible.',
      },
      {
        q: 'Will a child be alone in the lesson?',
        a: 'If you wish, a parent can watch the lesson. A short progress report is sent every month.',
      },
    ],
  },
  cta: {
    title: 'The first lesson is free',
    body: 'Write on Telegram — pick a track and a level, the bot asks the rest. No card needed.',
    button: 'Write on Telegram',
  },
  foot: { tagline: 'Online English with Mukhtasar Karimjonova' },
  segmentLabels: { bolalar: 'Kids', ielts: 'IELTS', kattalar: 'Adults' },
  levelLabels: {
    boshlovchi: 'Beginner',
    orta: 'Intermediate',
    bilmayman: 'Not sure',
  },
}

export const landing: Record<ContentLocale, Landing> = { uz, ru, en }
