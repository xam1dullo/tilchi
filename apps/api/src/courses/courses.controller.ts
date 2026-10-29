import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { authorize } from '../authz/policy'
import { LEVELS, SEGMENTS } from '../bot/start-payload'
import { Database } from '../db/database'
import { courses } from '../db/schema'
import { isUuid } from '../db/uuid'
import { Actor, Public } from '../http/actor'
import { uuidv7 } from '../id'

type CourseFields = Pick<
  typeof courses.$inferInsert,
  'title' | 'description' | 'segment' | 'level' | 'published'
>
type CourseChanges = Partial<CourseFields>

function parseFields(body: unknown, create: boolean): CourseChanges {
  const invalid = () => {
    throw new HttpException({ error: 'invalid_course' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid()
  const input = body as Record<string, unknown>
  const keys = ['title', 'description', 'segment', 'level', 'published']
  if (Object.keys(input).some((key) => !keys.includes(key))) return invalid()
  if (
    create &&
    ['title', 'description', 'segment', 'level'].some((key) => !(key in input))
  )
    return invalid()
  if (!create && Object.keys(input).length === 0) return invalid()
  const result: CourseChanges = {}
  for (const key of ['title', 'description'] as const) {
    if (key in input) {
      const value = input[key]
      if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.trim().length > (key === 'title' ? 120 : 2000)
      )
        return invalid()
      result[key] = value.trim()
    }
  }
  if ('segment' in input) {
    if (
      typeof input.segment !== 'string' ||
      !(SEGMENTS as readonly string[]).includes(input.segment)
    )
      return invalid()
    result.segment = input.segment
  }
  if ('level' in input) {
    if (
      typeof input.level !== 'string' ||
      !(LEVELS as readonly string[]).includes(input.level)
    )
      return invalid()
    result.level = input.level
  }
  if ('published' in input) {
    if (typeof input.published !== 'boolean') return invalid()
    result.published = input.published
  }
  return result
}

@Injectable()
export class CoursesService {
  constructor(@Inject(Database) private readonly database: Database) {}

  async list(publishedOnly: boolean) {
    return this.database.db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        segment: courses.segment,
        level: courses.level,
        published: courses.published,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(
        and(
          isNull(courses.deletedAt),
          publishedOnly ? eq(courses.published, true) : undefined,
        ),
      )
      .orderBy(asc(courses.createdAt), asc(courses.id))
  }

  async create(body: unknown) {
    const fields = parseFields(body, true) as CourseFields
    const [course] = await this.database.db
      .insert(courses)
      .values({ ...fields, id: uuidv7() })
      .returning()
    return course
  }

  async update(id: string, body: unknown) {
    const fields = parseFields(body, false)
    if (!isUuid(id)) throw new HttpException({ error: 'not_found' }, 404)
    const [course] = await this.database.db
      .update(courses)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(courses.id, id), isNull(courses.deletedAt)))
      .returning()
    if (!course) throw new HttpException({ error: 'not_found' }, 404)
    return course
  }

  async remove(id: string) {
    if (!isUuid(id)) throw new HttpException({ error: 'not_found' }, 404)
    const now = new Date()
    const [course] = await this.database.db
      .update(courses)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(courses.id, id), isNull(courses.deletedAt)))
      .returning({ id: courses.id })
    if (!course) throw new HttpException({ error: 'not_found' }, 404)
    return { ok: true }
  }
}

@Controller('api/courses')
export class CoursesController {
  constructor(
    @Inject(CoursesService) private readonly courses: CoursesService,
  ) {}

  @Public()
  @Get()
  async list() {
    return { courses: await this.courses.list(true) }
  }

  @Get('manage')
  async manage(@Actor() actor: Actor) {
    authorize(actor, 'course.manage')
    return { courses: await this.courses.list(false) }
  }

  @Post()
  create(@Actor() actor: Actor, @Body() body: unknown) {
    authorize(actor, 'course.manage')
    return this.courses.create(body)
  }

  @Patch(':id')
  update(
    @Actor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    authorize(actor, 'course.manage')
    return this.courses.update(id, body)
  }

  @Delete(':id')
  remove(@Actor() actor: Actor, @Param('id') id: string) {
    authorize(actor, 'course.manage')
    return this.courses.remove(id)
  }
}
