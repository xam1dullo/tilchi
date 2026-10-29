export type CourseSegment = 'bolalar' | 'ielts' | 'kattalar'
export type CourseLevel = 'boshlovchi' | 'orta' | 'bilmayman'

export type CourseRecord = {
  id: string
  title: string
  description: string
  segment: CourseSegment
  level: CourseLevel
  published: boolean
  createdAt: string
  updatedAt: string
}
