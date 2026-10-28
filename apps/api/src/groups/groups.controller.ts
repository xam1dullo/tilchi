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
    return this.groups.create({
      name,
      actor,
      teacherId: typeof teacherId === 'string' ? teacherId : undefined,
    })
  }

  @Get(':groupId')
  async get(@Param('groupId') groupId: string, @Actor() actor: Actor) {
    return groupView(actor, await this.groups.visible(actor, groupId))
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
