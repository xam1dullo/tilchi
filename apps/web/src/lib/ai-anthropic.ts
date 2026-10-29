import Anthropic from '@anthropic-ai/sdk'
import type { AiConfig, TextStream } from './ai-server'

export function anthropicStream(config: AiConfig): TextStream {
  const client = new Anthropic({ apiKey: config.apiKey })
  return async function* ({ system, user, model, maxTokens, signal }) {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      },
      { signal },
    )
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
