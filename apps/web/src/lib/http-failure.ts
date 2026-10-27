// The router serializes a loader error for the browser and keeps only its
// message, so the status has to live in the message to survive.
const FORBIDDEN = 'api_403'

export function apiFailure(status: number): Error {
  return new Error(`api_${status}`)
}

export function isForbidden(error: unknown): boolean {
  return error instanceof Error && error.message === FORBIDDEN
}
