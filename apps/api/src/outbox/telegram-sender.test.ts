import { afterEach, expect, it, vi } from 'vitest'
import { BotApi, TelegramError } from '../bot/bot-api'
import { TelegramCooldown, TelegramSender } from './telegram-sender'

afterEach(() => vi.unstubAllEnvs())

it('after a 429 every send, to any chat, waits out the cooldown', async () => {
  const deliver = vi
    .fn()
    .mockRejectedValueOnce(new TelegramError('slow', 429, 5))
    .mockResolvedValue(undefined)
  const sender = new TelegramSender({ deliver } as unknown as BotApi)
  await expect(sender.send('1', 'a')).rejects.toBeInstanceOf(TelegramError)
  await expect(sender.send('2', 'b')).rejects.toMatchObject({
    retryAfter: expect.any(Number),
  })
  await expect(sender.send('3', 'c')).rejects.toBeInstanceOf(TelegramCooldown)
  expect(deliver).toHaveBeenCalledTimes(1)
})

it('BotApi refuses to deliver without a token instead of pretending it sent', async () => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
  await expect(new BotApi().deliver('1', 'x')).rejects.toThrow(
    'TELEGRAM_BOT_TOKEN',
  )
})
