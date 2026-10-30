import { eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { users } from '../db/schema'
import { uuidv7 } from '../id'
import { actorOf } from '../test/actors'
import { describeWithDatabase } from '../test/postgres'
import { UsersController } from './users.controller'
import { UsersRepository } from './users.repository'

describeWithDatabase('UsersController', (current) => {
  const controller = () =>
    new UsersController(new UsersRepository(current().database))
  const admin = actorOf('admin')
  const outcome = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: { status?: number; response?: { error?: string } }) =>
        `${error.status} ${error.response?.error}`,
    )
  const kid = async () =>
    (
      await new UsersRepository(current().database).ensure({
        id: uuidv7(),
        role: 'learner',
        name: 'Kid',
      })
    ).id

  it('searches for admins only and returns no contact fields', async () => {
    const id = await kid()
    const found = await controller().search(admin, 'ki')
    expect(found).toEqual({
      users: [{ id, name: 'Kid', level: null, guardianConsent: false }],
    })
    expect(await controller().search(admin, ['ki'])).toEqual({ users: [] })
    expect(await controller().search(admin, undefined)).toEqual({ users: [] })
    for (const role of ['teacher', 'learner'] as const) {
      expect(await outcome(controller().search(actorOf(role), 'ki'))).toBe(
        '403 forbidden',
      )
    }
  })

  it('records a trimmed consent giver, and validates before looking up', async () => {
    const id = await kid()
    const record = (body: unknown, userId = id, actor = admin) =>
      outcome(controller().guardianConsent(userId, actor, body))
    expect(await record({ by: 'Mother' }, id, actorOf('teacher'))).toBe(
      '403 forbidden',
    )
    for (const body of [
      null,
      'Mother',
      {},
      { by: 5 },
      { by: '   ' },
      { by: 'x'.repeat(121) },
    ]) {
      expect(await record(body), JSON.stringify(body)).toBe(
        '400 invalid_guardian_consent',
      )
    }
    for (const userId of [uuidv7(), 'not-a-uuid']) {
      expect(await record({ by: 'Mother' }, userId)).toBe('404 user_not_found')
    }
    expect(
      await controller().guardianConsent(id, admin, {
        by: `  ${'x'.repeat(120)}  `,
      }),
    ).toEqual({ ok: true })
    const [row] = await current()
      .database.db.select()
      .from(users)
      .where(eq(users.id, id))
    expect(row.guardianConsentBy).toBe('x'.repeat(120))
    expect(row.guardianConsentAt).toBeInstanceOf(Date)
    expect((await controller().search(admin, 'kid')).users[0]).toMatchObject({
      guardianConsent: true,
    })
  })

  it('404s a deleted user', async () => {
    const id = await kid()
    await new UsersRepository(current().database).softDelete(id)
    expect(
      await outcome(controller().guardianConsent(id, admin, { by: 'Mother' })),
    ).toBe('404 user_not_found')
  })
})
