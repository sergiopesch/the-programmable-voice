const exactIsoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function isExactIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && exactIsoTimestampPattern.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}
