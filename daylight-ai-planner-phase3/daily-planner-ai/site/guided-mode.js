const GUIDE_TYPES = new Set(['cooking','interview','study','project','general'])

const text = (value, limit) => String(value || '').trim().slice(0, limit)

export function normalizeGuideResponse(value) {
  if (!value || typeof value !== 'object') return null
  const questions = Array.isArray(value.questions) ? value.questions.slice(0, 4).map((question, index) => ({
    id: text(question?.id || `question-${index + 1}`, 80),
    label: text(question?.label, 240),
    placeholder: text(question?.placeholder, 240),
  })).filter(question => question.label) : []
  const steps = Array.isArray(value.steps) ? value.steps.slice(0, 20).map((step, index) => ({
    id: `step-${index + 1}`,
    title: text(step?.title, 200),
    instruction: text(step?.instruction, 1800),
    durationMinutes: Math.max(0, Math.min(240, Number(step?.durationMinutes) || 0)),
    safetyNote: text(step?.safetyNote, 500),
    completed: false,
  })).filter(step => step.title && step.instruction) : []
  const needsInput = value.needsInput === true && questions.length > 0
  if (!needsInput && !steps.length) return null
  return {
    needsInput,
    questions: needsInput ? questions : [],
    title: text(value.title, 240),
    summary: text(value.summary, 1200),
    materials: Array.isArray(value.materials) ? value.materials.slice(0, 30).map(item => text(item, 240)).filter(Boolean) : [],
    steps: needsInput ? [] : steps,
  }
}

export function createSavedGuide(response, { id, sourceItemId = '', type = 'general', now = new Date().toISOString() } = {}) {
  const normalized = normalizeGuideResponse(response)
  if (!normalized || normalized.needsInput) return null
  return {
    id,
    sourceItemId,
    type: GUIDE_TYPES.has(type) ? type : 'general',
    title: normalized.title || 'Step-by-step guide',
    summary: normalized.summary,
    materials: normalized.materials,
    steps: normalized.steps,
    currentIndex: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function currentGuideStep(guide) {
  if (!guide?.steps?.length) return null
  const firstOpen = guide.steps.findIndex(step => !step.completed)
  const index = firstOpen < 0 ? guide.steps.length - 1 : Math.max(firstOpen, Math.min(guide.currentIndex || 0, guide.steps.length - 1))
  return { step: guide.steps[index], index, completedCount: guide.steps.filter(step => step.completed).length, total: guide.steps.length, finished: firstOpen < 0 }
}
