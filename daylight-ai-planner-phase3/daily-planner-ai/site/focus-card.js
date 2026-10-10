function minutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, mins] = value.split(':').map(Number)
  return hours * 60 + mins
}

export function selectFocusItem(items = [], { nowMinutes = 0, isCurrentDay = false } = {}) {
  const eligible = items
    .filter(item => item && !item.completed && !item.skipped && !item.unscheduled)
    .map((item, order) => ({ item, order, start: minutes(item.start), end: minutes(item.end) }))
    .sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER) || a.order - b.order)
  if (!eligible.length) return null
  if (!isCurrentDay) return { item: eligible[0].item, phase: 'next' }

  const active = eligible.find(entry => entry.start !== null && entry.end !== null && entry.start <= nowMinutes && nowMinutes < entry.end)
  if (active) return { item: active.item, phase: 'now' }
  const upcoming = eligible.find(entry => entry.start === null || entry.start >= nowMinutes)
  if (upcoming) return { item: upcoming.item, phase: 'next' }
  return { item: eligible[eligible.length - 1].item, phase: 'overdue' }
}
