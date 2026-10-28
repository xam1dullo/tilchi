export function clientIp(input: {
  realIp?: string
  requestIp?: string
  forwarded?: string
}) {
  const real = input.realIp?.trim()
  if (real) return real
  const requestIp = input.requestIp?.trim()
  if (requestIp) return requestIp
  return 'unknown'
}
