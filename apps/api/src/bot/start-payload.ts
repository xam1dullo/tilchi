export const SEGMENTS = ['bolalar', 'ielts', 'kattalar'] as const
export const LEVELS = ['boshlovchi', 'orta', 'bilmayman'] as const
export type Segment = (typeof SEGMENTS)[number]
export type Level = (typeof LEVELS)[number]

export type StartPayload =
  | { kind: 'handoff'; raw: string }
  | { kind: 'registration'; source: string | null; level: Level | null }

// A handoff id is a uuid, dashed or not. Anything this shape is a login
// request, even when expired, so a lead payload can never be read as one.
const HANDOFF_SHAPE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

const isSegment = (value: string): value is Segment =>
  (SEGMENTS as readonly string[]).includes(value)
const isLevel = (value: string): value is Level =>
  (LEVELS as readonly string[]).includes(value)

/** Routes `/start <payload>` by syntax. Unknown payloads are plain registration. */
export function classifyStartPayload(raw: string): StartPayload {
  if (HANDOFF_SHAPE.test(raw)) return { kind: 'handoff', raw }
  const [segment, level, ...rest] = raw.toLowerCase().split('_')
  if (!segment || !isSegment(segment) || rest.length > 0) {
    return { kind: 'registration', source: null, level: null }
  }
  if (level === undefined) {
    return { kind: 'registration', source: segment, level: null }
  }
  return isLevel(level)
    ? { kind: 'registration', source: `${segment}_${level}`, level }
    : { kind: 'registration', source: null, level: null }
}
