// PostgreSQL JSONB may return object keys in a different order from the
// browser copy. Compare the data rather than its original key order.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, ordered(value[key])]))
  }
  return value
}

export function sameCloudPayload(local, remote) {
  return JSON.stringify(ordered(local)) === JSON.stringify(ordered(remote))
}
