import {
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { LivekitWebhook } from './livekit-webhook'

const MAX_BODY_BYTES = 256 * 1024

/**
 * The signature covers the exact bytes, so the body is read raw. LiveKit
 * sends `application/webhook+json`, which Express's JSON parser skips.
 */
async function readRaw(req: Request) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      throw new HttpException({ error: 'payload_too_large' }, 413)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

@Controller('api/meet')
export class LivekitWebhookController {
  constructor(private readonly webhook: LivekitWebhook) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.webhook.handle({
      rawBody: await readRaw(req),
      authorization,
      apiKey: process.env.LIVEKIT_API_KEY ?? '',
      apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    })
  }
}
