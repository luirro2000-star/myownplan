const clean = value => typeof value === 'string' ? value.trim().slice(0, 240) : ''

export function captureQuestions(existing, texts, { source = 'assistant', now = new Date().toISOString(), idFactory = () => crypto.randomUUID() } = {}) {
  const questions = Array.isArray(existing) ? [...existing] : []
  const pending = new Set(questions.filter(item => item.status !== 'answered' && item.status !== 'dismissed').map(item => clean(item.text).toLowerCase()))
  for (const raw of Array.isArray(texts) ? texts : []) {
    const text = clean(raw)
    if (!text || pending.has(text.toLowerCase())) continue
    questions.push({ id: idFactory(), text, source, status: 'pending', createdAt: now })
    pending.add(text.toLowerCase())
  }
  return questions.slice(-50)
}

export function resolveQuestion(existing, id, status, now = new Date().toISOString()) {
  if (!['answered', 'dismissed'].includes(status)) return existing
  return (existing || []).map(item => item.id === id ? { ...item, status, resolvedAt: now } : item)
}

export function describeOperation(before, after) {
  const parts = []
  for (const [key, name] of [['items', 'planner blocks'], ['goals', 'goals'], ['openLoops', 'open loops'], ['rules', 'rules'], ['inbox', 'Inbox captures'], ['questions', 'questions']]) {
    const older = Array.isArray(before?.[key]) ? before[key] : []
    const newer = Array.isArray(after?.[key]) ? after[key] : []
    const added = newer.filter(item => !older.some(old => old.id === item.id)).length
    const removed = older.filter(item => !newer.some(next => next.id === item.id)).length
    const changed = newer.filter(item => older.some(old => old.id === item.id && JSON.stringify(old) !== JSON.stringify(item))).length
    if (added) parts.push(`${added} ${name} added`)
    if (removed) parts.push(`${removed} ${name} removed`)
    if (changed) parts.push(`${changed} ${name} updated`)
  }
  if (JSON.stringify(before?.plannerConfig) !== JSON.stringify(after?.plannerConfig)) parts.push('planning rules updated')
  return parts.slice(0, 4).join(' · ') || 'Planner details updated'
}
