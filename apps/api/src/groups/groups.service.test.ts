import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { Role } from '../auth/policy'
import { groups as groupsTable, users as usersTable } from '../db/schema'
import { uuidv7 } from '../id'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { GroupsRepository } from './groups.repository'
import { GROUP_CAPACITY, GroupsService } from './groups.service'
import { actorOf } from '../test/actors'

describeWithDatabase('GroupsService', (current) => {
  const users = () => new UsersRepository(current().database)
  const groups = () =>
    new GroupsService(new GroupsRepository(current().database))
  const person = async (role: Role, name = role) =>
    (await users().ensure({ id: uuidv7(), role, name })).id

  const outcome = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: { status?: number; response?: { error?: string } }) =>
        `${error.status} ${error.response?.error}`,
    )

  it('lets teachers create and only admins add members', async () => {
    const [teacher, learner, admin] = await Promise.all([
      person('teacher'),
      person('learner'),
      person('admin'),
    ])
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    expect(group).toEqual({
      id: expect.any(String),
      name: 'A1',
      capacity: 12,
      kind: 'adult',
      teacherId: teacher,
      memberIds: [teacher],
      learnerCount: 0,
    })
    expect((await groups().listForUser(teacher))[0]?.id).toBe(group.id)
    expect(
      await outcome(
        groups().addMember({
          groupId: group.id,
          userId: learner,
          actor: actorOf('teacher'),
        }),
      ),
    ).toBe('403 forbidden')
    const withMember = await groups().addMember({
      groupId: group.id,
      userId: learner,
      actor: actorOf('admin'),
    })
    expect(withMember.memberIds).toEqual([teacher, learner])
    expect(withMember.learnerCount).toBe(1)
    expect((await groups().listForUser(learner))[0]?.id).toBe(group.id)
    expect(await groups().listForUser(admin)).toEqual([])
  })

  it('keeps learners from creating groups', async () => {
    const learner = await person('learner')
    expect(
      await outcome(
        groups().create({ name: 'Nope', actor: actorOf('learner', learner) }),
      ),
    ).toBe('403 forbidden')
  })

  it('trims the name, caps it at 80 characters, and never stores a blank one', async () => {
    const teacher = await person('teacher')
    const make = (name: string) =>
      groups().create({ name, actor: actorOf('teacher', teacher) })
    expect((await make('  A1  ')).name).toBe('A1')
    expect((await make('x'.repeat(100))).name).toBe('x'.repeat(80))
    expect((await make('   ')).name).toBe('Group')
  })

  it('lists every group for an admin and keeps ensure idempotent', async () => {
    const [t1, t2, learner, admin] = await Promise.all([
      person('teacher'),
      person('teacher'),
      person('learner'),
      person('admin'),
    ])
    const id = uuidv7()
    const first = await groups().ensure({ id, name: 'A1', actorId: t1 })
    const second = await groups().ensure({ id, name: 'ignored', actorId: t2 })
    await groups().putMember(id, learner)
    expect(second.id).toBe(first.id)
    expect(second.name).toBe('A1')
    expect(second.memberIds).toEqual([t1])
    expect((await groups().get(id))?.memberIds).toEqual([t1, learner])
    expect(await groups().listForUser(admin, 'admin')).toHaveLength(1)
    expect(await groups().listForUser(learner, 'learner')).toHaveLength(1)
    expect(await groups().listForUser(t2, 'teacher')).toEqual([])
  })

  it('does not know groups that are missing, malformed, or deleted', async () => {
    const teacher = await person('teacher')
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    expect(await groups().get(uuidv7())).toBeNull()
    expect(await groups().get('not-a-uuid')).toBeNull()
    await current()
      .database.db.update(groupsTable)
      .set({ deletedAt: new Date() })
      .where(eq(groupsTable.id, group.id))
    expect(await groups().get(group.id)).toBeNull()
    expect(await groups().listForUser(teacher)).toEqual([])
    expect(await groups().listForUser(teacher, 'admin')).toEqual([])
    expect(
      await outcome(
        groups().ensure({ id: group.id, name: 'A1', actorId: teacher }),
      ),
    ).toBe('404 not_found')
  })

  it('refuses to add to a missing group or to add a missing user', async () => {
    const [teacher, learner] = await Promise.all([
      person('teacher'),
      person('learner'),
    ])
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    const add = (groupId: string, userId: string) =>
      outcome(groups().addMember({ groupId, userId, actor: actorOf('admin') }))
    expect(await add(uuidv7(), learner)).toBe('404 not_found')
    expect(await add('not-a-uuid', learner)).toBe('404 not_found')
    expect(await add(group.id, uuidv7())).toBe('404 user_not_found')
    expect(await add(group.id, '')).toBe('404 user_not_found')
    expect(await add(group.id, "x'; drop table users; --")).toBe(
      '404 user_not_found',
    )
    expect((await groups().get(group.id))?.memberIds).toEqual([teacher])
  })

  it('adds the same member only once', async () => {
    const [teacher, learner] = await Promise.all([
      person('teacher'),
      person('learner'),
    ])
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    await groups().putMember(group.id, learner)
    const again = await groups().putMember(group.id, learner)
    expect(again.memberIds).toEqual([teacher, learner])
  })

  it('holds 12 learners; the teacher and admins do not count', async () => {
    const [teacher, admin] = await Promise.all([
      person('teacher'),
      person('admin'),
    ])
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    const learners = await Promise.all(
      Array.from({ length: GROUP_CAPACITY + 1 }, () => person('learner')),
    )
    for (const learner of learners.slice(0, GROUP_CAPACITY)) {
      await groups().putMember(group.id, learner)
    }
    expect((await groups().get(group.id))?.memberIds).toHaveLength(
      GROUP_CAPACITY + 1,
    )
    expect(
      await outcome(groups().putMember(group.id, learners[GROUP_CAPACITY])),
    ).toBe('409 group_full')
    expect(await outcome(groups().putMember(group.id, learners[0]))).toBe('ok')
    expect(await outcome(groups().putMember(group.id, admin))).toBe('ok')
  })

  it('never lets racing adds go past 12 learners', async () => {
    const teacher = await person('teacher')
    const group = await groups().create({
      name: 'A1',
      actor: actorOf('teacher', teacher),
    })
    const learners = await Promise.all(
      Array.from({ length: GROUP_CAPACITY + 4 }, () => person('learner')),
    )
    const results = await Promise.all(
      learners.map((learner) => outcome(groups().putMember(group.id, learner))),
    )
    expect(results.filter((r) => r === 'ok')).toHaveLength(GROUP_CAPACITY)
    expect(results.filter((r) => r === '409 group_full')).toHaveLength(4)
  })

  describe('kids groups (G7)', () => {
    const kidsGroup = async () => {
      const teacher = await person('teacher')
      const group = await groups().create({
        name: 'Kids',
        actor: actorOf('teacher', teacher),
      })
      await current()
        .database.db.update(groupsTable)
        .set({ kind: 'kids' })
        .where(eq(groupsTable.id, group.id))
      return group
    }
    const consent = (id: string) =>
      current()
        .database.db.update(usersTable)
        .set({ guardianConsentBy: 'Mother', guardianConsentAt: new Date() })
        .where(eq(usersTable.id, id))

    it('refuses a learner without recorded guardian consent', async () => {
      const group = await kidsGroup()
      const kid = await person('learner')
      expect(await outcome(groups().putMember(group.id, kid))).toBe(
        '409 guardian_consent_required',
      )
      expect((await groups().get(group.id))?.memberIds).toHaveLength(1)
    })

    it('adds a learner once consent is recorded', async () => {
      const group = await kidsGroup()
      const kid = await person('learner')
      await consent(kid)
      expect(await outcome(groups().putMember(group.id, kid))).toBe('ok')
    })

    it('adds a learner after an admin records consent through the repository', async () => {
      const group = await kidsGroup()
      const kid = await person('learner')
      expect(await users().recordGuardianConsent(kid, 'Mother')).toBe(true)
      expect(await outcome(groups().putMember(group.id, kid))).toBe('ok')
    })

    it('needs both who and when', async () => {
      const group = await kidsGroup()
      const kid = await person('learner')
      await current()
        .database.db.update(usersTable)
        .set({ guardianConsentBy: 'Mother' })
        .where(eq(usersTable.id, kid))
      expect(await outcome(groups().putMember(group.id, kid))).toBe(
        '409 guardian_consent_required',
      )
    })

    it('leaves adult groups alone', async () => {
      const teacher = await person('teacher')
      const group = await groups().create({
        name: 'A1',
        actor: actorOf('teacher', teacher),
      })
      expect(
        await outcome(groups().putMember(group.id, await person('learner'))),
      ).toBe('ok')
    })
  })

  describe('members', () => {
    it('shows id, name and role to the teacher and admins only', async () => {
      const [teacher, learner, visitor, stranger] = await Promise.all([
        person('teacher'),
        person('learner'),
        person('teacher'),
        person('learner'),
      ])
      const group = await groups().create({
        name: 'A1',
        actor: actorOf('teacher', teacher),
      })
      await groups().putMember(group.id, learner)
      await groups().putMember(group.id, visitor)
      const expected = [
        { id: teacher, name: 'teacher', role: 'teacher' },
        { id: learner, name: 'learner', role: 'learner' },
        { id: visitor, name: 'teacher', role: 'teacher' },
      ]
      expect(
        await groups().members(actorOf('teacher', teacher), group.id),
      ).toEqual(expected)
      expect(await groups().members(actorOf('admin'), group.id)).toEqual(
        expected,
      )
      const as = (actor: ReturnType<typeof actorOf>) =>
        outcome(groups().members(actor, group.id))
      expect(await as(actorOf('learner', learner))).toBe('403 forbidden')
      expect(await as(actorOf('teacher', visitor))).toBe('403 forbidden')
      expect(await as(actorOf('learner', stranger))).toBe('404 not_found')
      expect(await outcome(groups().members(actorOf('admin'), uuidv7()))).toBe(
        '404 not_found',
      )
      expect(await outcome(groups().members(actorOf('admin'), 'nope'))).toBe(
        '404 not_found',
      )
    })
  })
})
