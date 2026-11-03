import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { can } from '../authz/policy'
import { groupView } from '../authz/views'
import { Actor } from '../http/actor'
import { GroupsService } from './groups.service'

@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  async list(@Actor() actor: Actor) {
    const groups = await this.groups.listForUser(actor.userId, actor.role)
    return {
      groups: groups.map((group) => groupView(actor, group)),
      can: {
        createGroup: can(actor, 'group.create'),
        assignTeacher: can(actor, 'teacher.list'),
        manageTests: can(actor, 'test.manage'),
      },
    }
  }

  @Post()
  async create(@Actor() actor: Actor, @Body() body: unknown) {
    const name =
      body &&
      typeof body === 'object' &&
      typeof (body as { name?: unknown }).name === 'string'
        ? (body as { name: string }).name
        : 'Group'
    const teacherId = (body as { teacherId?: unknown } | null)?.teacherId
    const courseId = (body as { courseId?: unknown } | null)?.courseId
    return this.groups.create({
      name,
      actor,
      teacherId: typeof teacherId === 'string' ? teacherId : undefined,
      // A missing or null courseId means "no course"; anything else must name one.
      courseId:
        courseId === undefined || courseId === null
          ? undefined
          : typeof courseId === 'string'
            ? courseId
            : '',
    })
  }

  @Post(':groupId/course')
  async setCourse(
    @Param('groupId') groupId: string,
    @Actor() actor: Actor,
    @Body() body: unknown,
  ) {
    const courseId = (body as { courseId?: unknown } | null)?.courseId
    return groupView(
      actor,
      await this.groups.setCourse(
        actor,
        groupId,
        // null clears; a non-string is an invalid course, not a clear.
        courseId === null || courseId === undefined
          ? null
          : typeof courseId === 'string'
            ? courseId
            : '',
      ),
    )
  }

  @Get(':groupId')
  async get(@Param('groupId') groupId: string, @Actor() actor: Actor) {
    return groupView(actor, await this.groups.visible(actor, groupId))
  }

  @Get(':groupId/members')
  async members(@Param('groupId') groupId: string, @Actor() actor: Actor) {
    return { members: await this.groups.members(actor, groupId) }
  }

  @Post(':groupId/members')
  async addMember(
    @Param('groupId') groupId: string,
    @Actor() actor: Actor,
    @Body() body: unknown,
  ) {
    const userId =
      body &&
      typeof body === 'object' &&
      typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId
        : ''
    return this.groups.addMember({ groupId, userId, actor })
  }
}
