const validActual = value => Number.isInteger(Number(value)) && Number(value) >= 5 && Number(value) <= 480

export function finishWork(state, itemId, { now = new Date().toISOString(), idFactory = () => crypto.randomUUID() } = {}) {
  const next = structuredClone(state)
  const item = next.items.find(entry => entry.id === itemId)
  if (!item || item.completed || item.skipped) return next
  item.completed = true
  if (item.flexible === false || item.locked) return next
  item.completedAt = now
  item.actualMinutes = item.durationMinutes || 30
  next.workLog ||= []
  next.workLog.push({ id: idFactory(), itemId, title: item.title, day: item.day, plannedStart: item.start || '', outcome: 'completed', estimatedMinutes: item.durationMinutes || 30, actualMinutes: item.actualMinutes, at: now })
  next.workLog = next.workLog.slice(-500)
  return next
}

export function reopenWork(state, itemId) {
  const next = structuredClone(state)
  const item = next.items.find(entry => entry.id === itemId)
  if (!item || !item.completed) return next
  item.completed = false
  delete item.completedAt
  delete item.actualMinutes
  const index = (next.workLog || []).findLastIndex(entry => entry.itemId === itemId && entry.outcome === 'completed')
  if (index >= 0) next.workLog.splice(index, 1)
  return next
}

export function skipWork(state, itemId, { now = new Date().toISOString(), idFactory = () => crypto.randomUUID() } = {}) {
  const next = structuredClone(state)
  const item = next.items.find(entry => entry.id === itemId)
  if (!item || item.completed || item.skipped || item.flexible === false || item.locked) return next
  item.skipped = true
  item.skippedAt = now
  const plannedStart = item.start || ''
  item.start = ''
  item.end = ''
  item.unscheduled = false
  next.workLog ||= []
  next.workLog.push({ id: idFactory(), itemId, title: item.title, day: item.day, plannedStart, outcome: 'skipped', estimatedMinutes: item.durationMinutes || 30, at: now })
  next.workLog = next.workLog.slice(-500)
  return next
}

export function resumeWork(state, itemId) {
  const next = structuredClone(state)
  const item = next.items.find(entry => entry.id === itemId)
  if (!item || !item.skipped) return next
  item.skipped = false
  item.unscheduled = true
  delete item.skippedAt
  const index = (next.workLog || []).findLastIndex(entry => entry.itemId === itemId && entry.outcome === 'skipped')
  if (index >= 0) next.workLog.splice(index, 1)
  return next
}

export function setActualTime(state, itemId, minutes) {
  const next = structuredClone(state)
  const item = next.items.find(entry => entry.id === itemId)
  if (!item?.completed || !validActual(minutes)) return next
  item.actualMinutes = Number(minutes)
  const record = [...(next.workLog || [])].reverse().find(entry => entry.itemId === itemId && entry.outcome === 'completed')
  if (record) record.actualMinutes = item.actualMinutes
  return next
}
