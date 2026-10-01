import { DAYS } from './planner-engine.js'

export const INTAKE_TYPES = ['event','task','routine','rule','goal','metric','open_loop']

export function normalizeIntakeAnalysis(input = {}) {
  const understood = Array.isArray(input.understood) ? input.understood : []
  const items = understood.map((entry, index) => normalizeEntry(entry, index)).filter(Boolean)
  return {
    summary: clean(input.summary) || `I found ${items.length} planning item${items.length === 1 ? '' : 's'}.`,
    items,
    questions: (Array.isArray(input.questions) ? input.questions : []).map(clean).filter(Boolean).slice(0, 8),
  }
}

export function normalizeEntry(entry = {}, index = 0) {
  const type = INTAKE_TYPES.includes(entry.type) ? entry.type : 'open_loop'
  const day = DAYS.includes(entry.day) ? entry.day : ''
  const recurrence = ['once','daily','weekdays','weekly','custom'].includes(entry.recurrence) ? entry.recurrence : 'once'
  const confidence = clamp(Number(entry.confidence ?? 0.75), 0, 1)
  return {
    reviewId: clean(entry.reviewId) || `review-${index + 1}`,
    type,
    title: clean(entry.title) || clean(entry.sourceText) || 'Untitled',
    sourceText: clean(entry.sourceText),
    day,
    start: validTime(entry.start) ? entry.start : '',
    end: validTime(entry.end) ? entry.end : '',
    durationMinutes: positiveInt(entry.durationMinutes),
    recurrence,
    priority: clamp(Math.round(Number(entry.priority || 2)), 1, 4),
    details: clean(entry.details),
    target: Number.isFinite(Number(entry.target)) ? Number(entry.target) : 0,
    unit: clean(entry.unit),
    deadlineDay: DAYS.includes(entry.deadlineDay) ? entry.deadlineDay : '',
    preferredStart: validTime(entry.preferredStart) ? entry.preferredStart : '',
    preferredEnd: validTime(entry.preferredEnd) ? entry.preferredEnd : '',
    splittable: entry.splittable === true,
    minBlockMinutes: positiveInt(entry.minBlockMinutes) || 30,
    confidence,
    needsConfirmation: entry.needsConfirmation === true || confidence < 0.66,
    question: clean(entry.question),
    accepted: entry.accepted !== false && !(entry.needsConfirmation === true || confidence < 0.66),
  }
}

export function applyIntakeAnalysis(state, analysis, options = {}) {
  const next = structuredClone(state)
  next.items ||= []
  next.rules ||= []
  next.goals ||= []
  next.metrics ||= []
  next.openLoops ||= []
  next.inbox ||= []
  const idFactory = options.idFactory || (() => `id-${Math.random().toString(36).slice(2)}`)
  const applied = []

  for (const entry of analysis.items || []) {
    if (entry.accepted === false) continue
    const ids = applyEntry(next, entry, idFactory)
    applied.push({ reviewId: entry.reviewId, type: entry.type, title: entry.title, ids })
  }
  return { state: next, applied }
}

function applyEntry(state, entry, idFactory) {
  if (entry.type === 'rule') {
    const id = idFactory()
    state.rules.push({ id, text: entry.details || entry.title, sourceText: entry.sourceText || undefined })
    return [id]
  }
  if (entry.type === 'goal') {
    const id = idFactory()
    state.goals.push({
      id,
      title: entry.title,
      cadence: entry.recurrence === 'once' ? (entry.details || 'Ongoing') : recurrenceLabel(entry.recurrence),
      progress: 0,
      target: entry.target > 0 ? entry.target : 1,
      unit: entry.unit || 'target',
      note: entry.details || undefined,
      sourceText: entry.sourceText || undefined,
    })
    return [id]
  }
  if (entry.type === 'metric') {
    const id = idFactory()
    state.metrics.push({
      id,
      title: entry.title,
      target: entry.target || 1,
      unit: entry.unit || 'units',
      cadence: recurrenceLabel(entry.recurrence),
      progress: 0,
      details: entry.details || undefined,
      sourceText: entry.sourceText || undefined,
    })
    return [id]
  }
  if (entry.type === 'open_loop') {
    const id = idFactory()
    state.openLoops.push({
      id,
      title: entry.title,
      status: 'open',
      details: entry.details || undefined,
      sourceText: entry.sourceText || undefined,
      createdAt: new Date().toISOString(),
    })
    return [id]
  }

  const days = recurrenceDays(entry)
  const ids = []
  for (const day of days) {
    const id = idFactory()
    const isEvent = entry.type === 'event'
    const isRoutine = entry.type === 'routine'
    const routineIsFixed = isRoutine && Boolean(entry.start)
    const duration = entry.durationMinutes || durationFromTimes(entry.start, entry.end) || (isRoutine ? 15 : 30)
    state.items.push({
      id,
      title: entry.title,
      day,
      start: entry.start || '',
      end: entry.end || (entry.start ? addMinutes(entry.start, duration) : ''),
      durationMinutes: duration,
      kind: isRoutine ? 'routine' : isEvent ? 'event' : 'task',
      completed: false,
      flexible: !isEvent && !routineIsFixed,
      locked: isEvent || routineIsFixed,
      priority: entry.priority || 2,
      splittable: entry.type === 'task' ? entry.splittable === true : false,
      minBlockMinutes: entry.minBlockMinutes || 30,
      deadlineDay: entry.deadlineDay || (isRoutine && entry.recurrence !== 'once' ? day : undefined),
      preferredWindow: entry.preferredStart || entry.preferredEnd ? {
        start: entry.preferredStart || '07:00',
        end: entry.preferredEnd || '22:30',
      } : undefined,
      note: entry.details || undefined,
      sourceText: entry.sourceText || undefined,
      recurrence: entry.recurrence,
      generatedFromIntake: true,
    })
    ids.push(id)
  }
  return ids
}

function recurrenceDays(entry) {
  if (entry.recurrence === 'daily' || entry.recurrence === 'weekdays') return [...DAYS]
  if (entry.recurrence === 'weekly' && entry.day) return [entry.day]
  if (entry.day) return [entry.day]
  return [DAYS[0]]
}

export function localIntakeFallback(text) {
  const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean)
  const items = []
  let currentDay = ''
  for (const raw of lines) {
    const stripped = raw.replace(/^[-•.*]+\s*/, '').trim()
    const dayMatch = DAYS.find(day => stripped.toLowerCase() === day.toLowerCase())
    if (dayMatch) { currentDay = dayMatch; continue }

    const eventMatch = stripped.match(/^(\d{1,2}(?::\d{2})?)\s*[-–—:]\s*(.+)$/)
    if (eventMatch && currentDay) {
      const start = parseLooseTime(eventMatch[1], eventMatch[2])
      items.push(normalizeEntry({ type:'event', title:eventMatch[2].trim(), sourceText:raw, day:currentDay, start, recurrence:'once', confidence:start ? .72 : .55, needsConfirmation:!start, question:!start?'What time is this?':'' }, items.length))
      continue
    }

    if (/\bevery\s*day\b|\bdaily\b/i.test(stripped) || /^make my bed/i.test(stripped) || /^brush my teeth/i.test(stripped)) {
      items.push(normalizeEntry({ type:'routine', title:stripped.replace(/\bevery\s*day\b/ig,'').replace(/\bdaily\b/ig,'').trim().replace(/[.]$/,''), sourceText:raw, recurrence:'daily', confidence:.72, details:'Recurring daily routine.' }, items.length))
      continue
    }
    if (/\bat least\s+\d+\s+times?\s+a\s+week/i.test(stripped) || /\bgoal\b/i.test(stripped)) {
      items.push(normalizeEntry({ type:'goal', title:stripped.replace(/[.]$/,''), sourceText:raw, recurrence:'weekly', confidence:.7, details:stripped }, items.length))
      continue
    }
    if (/\bif\b.+\bthen\b|\bif\b.+\bgo to bed\b/i.test(stripped)) {
      items.push(normalizeEntry({ type:'rule', title:stripped.replace(/[.]$/,''), sourceText:raw, confidence:.7, details:stripped }, items.length))
      continue
    }
    if (/\bpoints?\b/i.test(stripped)) {
      const target = Number(stripped.match(/\b(\d{3,})\b/)?.[1] || 0)
      items.push(normalizeEntry({ type:'metric', title:'School points', sourceText:raw, target, unit:'points', recurrence:'daily', confidence:.76, details:stripped }, items.length))
      continue
    }
    items.push(normalizeEntry({ type:'open_loop', title:stripped.replace(/[.]$/,''), sourceText:raw, confidence:.45, needsConfirmation:true, question:'Should this become a task, goal, rule, or stay as an open loop?' }, items.length))
  }
  return normalizeIntakeAnalysis({
    summary: `Offline fallback found ${items.length} possible planning items. Connect Anthropic for deeper interpretation.`,
    understood: items,
    questions: items.filter(i => i.needsConfirmation && i.question).map(i => i.question).slice(0,4),
  })
}

function parseLooseTime(value, context='') {
  const parts = value.split(':').map(Number)
  let h = parts[0], m = parts[1] || 0
  if (h < 1 || h > 12 || m > 59) return ''
  if (/\bpm\b/i.test(context) && h < 12) h += 12
  if (/\bam\b/i.test(context) && h === 12) h = 0
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function durationFromTimes(start, end) {
  if (!validTime(start) || !validTime(end)) return 0
  const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}
function addMinutes(time, amount) {
  if (!validTime(time)) return ''
  const [h,m] = time.split(':').map(Number)
  const total = Math.min(1439, h*60+m+amount)
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}
function recurrenceLabel(value) {
  return ({ daily:'Daily', weekdays:'Weekdays', weekly:'Weekly', custom:'Custom', once:'Ongoing' })[value] || 'Ongoing'
}
function validTime(v) { return typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) }
function positiveInt(v) { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0 }
function clean(v) { return typeof v === 'string' ? v.trim() : '' }
function clamp(v,min,max) { return Math.max(min,Math.min(max,Number.isFinite(v)?v:min)) }
