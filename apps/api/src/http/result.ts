import { HttpException } from '@nestjs/common'

// Pure rules return a Result so they stay free of Nest; a service turns a
// failure into the JSON error body clients read: { "error": "<code>" }.
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const fail = (status: number, error: string): Result<never> => ({
  ok: false,
  status,
  error,
})

export const apiError = (status: number, error: string) =>
  new HttpException({ error }, status)

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw apiError(result.status, result.error)
  return result.value
}
