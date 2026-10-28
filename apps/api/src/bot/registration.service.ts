import { Inject, Injectable } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { KV, type Kv } from '../redis/kv'
import { UsersRepository } from '../users/users.repository'
import { BotApi, adminChatIds, publicAppUrl } from './bot-api'
import {
  alreadyRegistered,
  consentPrompt,
  doneNotice,
  fieldPrompt,
  revokedNotice,
} from './replies'
import {
  CONSENT_VERSION,
  type Registration,
  hasConsent,
  nextField,
  parseAnswer,
} from './registration'
import type { BotAction } from './updates'

const STATE_TTL_SECONDS = 7 * 24 * 60 * 60

/** What a visitor arrived with, kept until they consent and the row exists. */
type Pending = { source: string | null; level: string | null }

const stateKey = (telegramUserId: string) => `reg:${telegramUserId}`

const NO_PENDING: Pending = { source: null, level: null }

type Reply = object | null
type Of<T extends BotAction['type']> = Extract<BotAction, { type: T }>

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(KV) private readonly kv: Kv,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(BotApi) private readonly api: BotApi,
  ) {}

  async start(action: Of<'start_registration'>): Promise<Reply> {
    const known = await this.users.registration(action.telegramUserId)
    if (known && hasConsent(known)) {
      if (!nextField(known)) {
        return alreadyRegistered(action.chatId, action.lang, publicAppUrl())
      }
      await this.remember(action.telegramUserId, action)
      return fieldPrompt(action.chatId, action.lang, nextField(known) ?? 'name')
    }
    await this.remember(action.telegramUserId, action)
    return consentPrompt(action.chatId, action.lang)
  }

  async consent(action: Of<'consent'>): Promise<Reply> {
    const pending = await this.pending(action.telegramUserId)
    const reg = await this.users.recordConsent({
      telegramUserId: action.telegramUserId,
      version: CONSENT_VERSION,
      now: new Date(),
      source: pending?.source ?? null,
      level: pending?.level ?? null,
    })
    await this.remember(action.telegramUserId, pending ?? NO_PENDING)
    const field = nextField(reg)
    return field
      ? fieldPrompt(action.chatId, action.lang, field)
      : alreadyRegistered(action.chatId, action.lang, publicAppUrl())
  }

  async answer(action: Of<'answer'>): Promise<Reply> {
    // Free text only counts inside a registration the user started.
    if (!(await this.kv.get(stateKey(action.telegramUserId)))) return null
    const reg = await this.users.registration(action.telegramUserId)
    if (!reg || !hasConsent(reg)) return null
    const field = nextField(reg)
    if (!field) return null
    const value = parseAnswer(field, action.text)
    if (value === null)
      return fieldPrompt(action.chatId, action.lang, field, true)
    const saved = await this.users.saveAnswer(
      action.telegramUserId,
      field,
      value,
    )
    // A redelivered update finds the field already filled: nothing to do.
    if (!saved) return null
    const following = nextField(saved)
    if (following) return fieldPrompt(action.chatId, action.lang, following)
    await this.kv.del(stateKey(action.telegramUserId))
    await this.alertAdmins(action.telegramUserId, saved)
    return doneNotice(action.chatId, action.lang, publicAppUrl())
  }

  async revokeAll(action: Of<'revoke_all'>): Promise<Reply> {
    const user = await this.users.registration(action.telegramUserId)
    const count = user ? await this.auth.revokeAll(user.userId) : 0
    return revokedNotice(action.chatId, action.lang, count)
  }

  /** Never includes the phone number. */
  private async alertAdmins(telegramUserId: string, reg: Registration) {
    const text = [
      'New registration',
      `Name: ${reg.name}`,
      `Level: ${reg.level}`,
      `Source: ${reg.source ?? 'direct'}`,
      `Chat: tg://user?id=${telegramUserId}`,
    ].join('\n')
    await Promise.all(adminChatIds().map((id) => this.api.send(id, text)))
  }

  private remember(telegramUserId: string, pending: Pending) {
    const value: Pending = { source: pending.source, level: pending.level }
    return this.kv.set(
      stateKey(telegramUserId),
      JSON.stringify(value),
      STATE_TTL_SECONDS,
    )
  }

  private async pending(telegramUserId: string): Promise<Pending | null> {
    const raw = await this.kv.get(stateKey(telegramUserId))
    return raw ? (JSON.parse(raw) as Pending) : null
  }
}
