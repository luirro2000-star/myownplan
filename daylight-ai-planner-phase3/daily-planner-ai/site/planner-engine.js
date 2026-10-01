export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const DEFAULT_PLANNER_CONFIG = {
  dayStart: '07:00',
  dayEnd: '22:30',
  protectedFreeMinutes: {
    Monday: 120,
    Tuesday: 120,
    Wednesday: 120,
    Thursday: 180,
    Friday: 300,
  },
  transitionMinutes: 10,
}

export function toMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function toTime(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function itemDuration(item) {
  if (Number.isFinite(item.durationMinutes) && item.durationMinutes > 0) return item.durationMinutes
  const start = toMinutes(item.start)
  const end = toMinutes(item.end)
  return start == null || end == null ? 0 : Math.max(0, end - start)
}

export function effectiveInterval(item) {
  const start = toMinutes(item.start)
  const end = toMinutes(item.end)
  if (start == null || end == null) return null
  return {
    start: Math.max(0, start - (item.bufferBefore || 0)),
    end: Math.min(1440, end + (item.bufferAfter || 0)),
  }
}

export function isAnchored(item) {
  return item.locked === true || item.flexible === false || item.kind === 'event'
}

function sortIntervals(intervals) {
  return intervals
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export function mergeIntervals(intervals) {
  const sorted = sortIntervals(intervals)
  if (!sorted.length) return []
  const merged = [structuredClone(sorted[0])]
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (current.start <= last.end) last.end = Math.max(last.end, current.end)
    else merged.push(structuredClone(current))
  }
  return merged
}

export function dayBounds(config = DEFAULT_PLANNER_CONFIG, day) {
  return {
    start: toMinutes(config.dayStart) ?? 420,
    end: toMinutes(config.dayEnd) ?? 1350,
    protectedFree: config.protectedFreeMinutes?.[day] ?? 120,
  }
}

export function busyIntervals(items, { includeFlexible = true, excludeId = null } = {}) {
  return mergeIntervals(items
    .filter(item => item.id !== excludeId && item.start && item.end && (includeFlexible || isAnchored(item)))
    .map(effectiveInterval))
}

export function freeIntervals(items, day, config = DEFAULT_PLANNER_CONFIG, options = {}) {
  const bounds = dayBounds(config, day)
  const busy = busyIntervals(items, options)
    .map(i => ({ start: Math.max(bounds.start, i.start), end: Math.min(bounds.end, i.end) }))
    .filter(i => i.end > i.start)
  const merged = mergeIntervals(busy)
  const free = []
  let cursor = bounds.start
  for (const block of merged) {
    if (block.start > cursor) free.push({ start: cursor, end: block.start, minutes: block.start - cursor })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < bounds.end) free.push({ start: cursor, end: bounds.end, minutes: bounds.end - cursor })
  return free
}

export function dayMetrics(items, day, config = DEFAULT_PLANNER_CONFIG) {
  const dayItems = items.filter(i => i.day === day && !i.archived)
  const bounds = dayBounds(config, day)
  const fixedMinutes = mergeIntervals(dayItems.filter(isAnchored).map(effectiveInterval)).reduce((sum, i) => sum + Math.max(0, i.end - i.start), 0)
  const flexibleMinutes = dayItems.filter(i => !isAnchored(i) && !i.completed).reduce((sum, i) => sum + itemDuration(i), 0)
  const allBusy = mergeIntervals(dayItems.filter(i => i.start && i.end && !i.completed).map(effectiveInterval)).reduce((sum, i) => sum + Math.max(0, i.end - i.start), 0)
  const total = Math.max(0, bounds.end - bounds.start)
  const openMinutes = Math.max(0, total - allBusy)
  const schedulableMinutes = Math.max(0, total - fixedMinutes - bounds.protectedFree)
  return {
    totalMinutes: total,
    fixedMinutes,
    flexibleMinutes,
    openMinutes,
    protectedFreeMinutes: bounds.protectedFree,
    schedulableMinutes,
    overloaded: flexibleMinutes > schedulableMinutes,
  }
}

export function detectConflicts(items, day) {
  const dayItems = items.filter(i => i.day === day && i.start && i.end && !i.archived)
    .map(item => ({ item, interval: effectiveInterval(item) }))
    .filter(x => x.interval)
    .sort((a, b) => a.interval.start - b.interval.start)
  const conflicts = []
  for (let a = 0; a < dayItems.length; a++) {
    for (let b = a + 1; b < dayItems.length; b++) {
      if (dayItems[b].interval.start >= dayItems[a].interval.end) break
      if (dayItems[b].interval.start < dayItems[a].interval.end && dayItems[b].interval.end > dayItems[a].interval.start) {
        conflicts.push({ a: dayItems[a].item, b: dayItems[b].item })
      }
    }
  }
  return conflicts
}

function priorityScore(item) {
  const p = Number(item.priority || 2)
  const deadlineIndex = DAYS.indexOf(item.deadlineDay)
  const dayIndex = DAYS.indexOf(item.day)
  const deadlineBoost = deadlineIndex >= 0 ? Math.max(0, 8 - deadlineIndex) : 0
  const existingDayBoost = dayIndex >= 0 ? Math.max(0, 3 - dayIndex * 0.2) : 0
  return p * 10 + deadlineBoost + existingDayBoost
}

function candidateDays(item, startDay) {
  const startIndex = Math.max(0, DAYS.indexOf(startDay || item.day))
  const dueIndex = DAYS.indexOf(item.deadlineDay)
  if (dueIndex >= 0 && dueIndex < startIndex) return []
  const endIndex = dueIndex >= startIndex ? dueIndex : DAYS.length - 1
  const currentIndex = Math.max(startIndex, DAYS.indexOf(item.day))
  const result = []
  if (currentIndex >= startIndex && currentIndex <= endIndex) result.push(DAYS[currentIndex])
  for (let i = startIndex; i <= endIndex; i++) if (!result.includes(DAYS[i])) result.push(DAYS[i])
  return result
}

function windowBounds(item, day, config) {
  const bounds = dayBounds(config, day)
  const preferred = item.preferredWindow || {}
  return {
    start: Math.max(bounds.start, toMinutes(preferred.start) ?? bounds.start),
    end: Math.min(bounds.end, toMinutes(preferred.end) ?? bounds.end),
  }
}

function availableCapacity(items, day, config) {
  const metrics = dayMetrics(items, day, config)
  return Math.max(0, metrics.openMinutes - metrics.protectedFreeMinutes)
}


function canKeepExistingSlot(items, item, day, config, { notBefore = null } = {}) {
  const start = toMinutes(item.start)
  const end = toMinutes(item.end)
  if (start == null || end == null || end <= start) return false
  if (end - start < itemDuration(item)) return false
  const window = windowBounds(item, day, config)
  if (start < window.start || end > window.end) return false
  if (notBefore != null && start < notBefore) return false
  if (availableCapacity(items, day, config) < itemDuration(item)) return false
  return freeIntervals(items.filter(i => i.day === day), day, config).some(slot => slot.start <= start && slot.end >= end)
}

function chooseSlot(items, item, day, config, { notBefore = null } = {}) {
  const duration = itemDuration(item)
  if (!duration) return null
  if (availableCapacity(items, day, config) < duration) return null
  const window = windowBounds(item, day, config)
  const lowerBound = notBefore == null ? window.start : Math.max(window.start, notBefore)
  const slots = freeIntervals(items.filter(i => i.day === day), day, config)
  for (const slot of slots) {
    const start = Math.max(slot.start, lowerBound)
    const endLimit = Math.min(slot.end, window.end)
    if (endLimit - start >= duration) return { start, end: start + duration }
  }
  return null
}

function addPlacedItem(items, item, day, slot, extra = {}) {
  const updated = {
    ...item,
    ...extra,
    day,
    start: toTime(slot.start),
    end: toTime(slot.end),
    durationMinutes: itemDuration(item),
    unscheduled: false,
  }
  const index = items.findIndex(i => i.id === item.id)
  if (index >= 0) items[index] = updated
  else items.push(updated)
  return updated
}

function splitAcrossSlots(items, item, day, config, { notBefore = null, idFactory = null } = {}) {
  const total = itemDuration(item)
  const minBlock = Math.max(15, item.minBlockMinutes || 30)
  let remaining = total
  let first = true
  const pieces = []
  const window = windowBounds(item, day, config)
  const slots = freeIntervals(items.filter(i => i.day === day), day, config)
  const reserve = dayBounds(config, day).protectedFree
  let capacity = Math.max(0, dayMetrics(items, day, config).openMinutes - reserve)
  for (const free of slots) {
    if (remaining <= 0 || capacity < minBlock) break
    const slotStart = Math.max(free.start, window.start, notBefore ?? window.start)
    const slotEnd = Math.min(free.end, window.end)
    const possible = Math.min(slotEnd - slotStart, remaining, capacity)
    if (possible < minBlock) continue
    const chunk = remaining - possible > 0 && remaining - possible < minBlock ? Math.max(minBlock, possible - (minBlock - (remaining - possible))) : possible
    if (chunk < minBlock) continue
    const piece = {
      ...item,
      id: first ? item.id : (idFactory ? idFactory() : `${item.id}-part-${pieces.length + 1}`),
      parentId: first ? item.parentId : (item.parentId || item.id),
      title: first ? item.title : `${item.title} · part ${pieces.length + 1}`,
      durationMinutes: chunk,
      day,
      start: toTime(slotStart),
      end: toTime(slotStart + chunk),
      unscheduled: false,
    }
    const index = items.findIndex(i => i.id === piece.id)
    if (index >= 0) items[index] = piece
    else items.push(piece)
    pieces.push(piece)
    remaining -= chunk
    capacity -= chunk
    first = false
  }
  return { pieces, remaining }
}

export function planWeek(inputItems, config = DEFAULT_PLANNER_CONFIG, options = {}) {
  const idFactory = options.idFactory
  const startDay = options.startDay || DAYS[0]
  const freezeBefore = options.freezeBefore || null
  const items = structuredClone(inputItems)
  const changes = []
  const unscheduled = []

  const startIndex = Math.max(0, DAYS.indexOf(startDay))
  const movable = items
    .filter(i => !i.archived && !i.completed && !isAnchored(i) && itemDuration(i) > 0 && DAYS.indexOf(i.day) >= startIndex)
    .sort((a, b) => priorityScore(b) - priorityScore(a))

  // Remove movable blocks from the time grid before calculating placements.
  for (const item of movable) {
    const idx = items.findIndex(i => i.id === item.id)
    if (idx >= 0) items[idx] = { ...items[idx], start: '', end: '', unscheduled: true }
  }

  for (const original of movable) {
    const before = inputItems.find(i => i.id === original.id)
    let placed = null
    const days = candidateDays(original, startDay)
    for (const day of days) {
      const notBefore = freezeBefore && day === freezeBefore.day ? freezeBefore.minutes : null
      if (day === before?.day && canKeepExistingSlot(items, before, day, config, { notBefore })) {
        placed = addPlacedItem(items, before, day, { start: toMinutes(before.start), end: toMinutes(before.end) })
        break
      }
      const slot = chooseSlot(items, original, day, config, { notBefore })
      if (slot) {
        placed = addPlacedItem(items, original, day, slot)
        break
      }
      if (original.splittable) {
        const split = splitAcrossSlots(items, original, day, config, { notBefore, idFactory })
        if (split.remaining === 0 && split.pieces.length) {
          placed = split.pieces[0]
          if (split.pieces.length > 1) changes.push({ type: 'split', itemId: original.id, title: original.title, parts: split.pieces.length })
          break
        }
        // Roll back partial split if the task cannot be fully accommodated on this day.
        if (split.pieces.length) {
          const ids = new Set(split.pieces.map(p => p.id))
          for (let i = items.length - 1; i >= 0; i--) if (ids.has(items[i].id)) items.splice(i, 1)
          const originalIndex = items.findIndex(i => i.id === original.id)
          if (originalIndex < 0) items.push({ ...original, start: '', end: '', unscheduled: true })
          else items[originalIndex] = { ...original, start: '', end: '', unscheduled: true }
        }
      }
    }

    if (!placed) {
      unscheduled.push({ id: original.id, title: original.title, reason: 'No feasible slot without violating fixed commitments or protected free time.' })
      continue
    }

    if (!before || before.day !== placed.day || before.start !== placed.start || before.end !== placed.end) {
      changes.push({
        type: before?.start ? 'move' : 'schedule',
        itemId: original.id,
        title: original.title,
        from: before?.start ? `${before.day} ${before.start}` : 'Unscheduled',
        to: `${placed.day} ${placed.start}`,
      })
    }
  }

  return { items, changes, unscheduled, diagnostics: weekDiagnostics(items, config) }
}

export function replanDayFromNow(inputItems, day, nowMinutes, config = DEFAULT_PLANNER_CONFIG, options = {}) {
  // Completed items and fixed commitments remain history. Uncompleted flexible work
  // that was planned earlier in the day is considered missed and moves forward.
  return planWeek(inputItems, config, {
    ...options,
    startDay: day,
    freezeBefore: { day, minutes: nowMinutes },
  })
}

export function weekDiagnostics(items, config = DEFAULT_PLANNER_CONFIG) {
  const byDay = {}
  const warnings = []
  for (const day of DAYS) {
    const metrics = dayMetrics(items, day, config)
    const conflicts = detectConflicts(items, day)
    byDay[day] = { ...metrics, conflicts: conflicts.length }
    if (conflicts.length) warnings.push(`${day}: ${conflicts.length} schedule conflict${conflicts.length === 1 ? '' : 's'}.`)
    if (metrics.openMinutes < metrics.protectedFreeMinutes) warnings.push(`${day}: protected free-time target is not currently met.`)
  }
  return { byDay, warnings }
}
