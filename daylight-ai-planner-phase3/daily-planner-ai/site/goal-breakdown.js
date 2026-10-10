import { DAYS } from './planner-engine.js'

const clean = value => typeof value === 'string' ? value.trim().slice(0, 240) : ''

export function starterGoalBreakdown(title) {
  const subject = clean(title) || 'this goal'
  return {
    summary: `Start by making ${subject} concrete. You can change these suggestions before saving.`,
    milestones: [
      `Define what progress on ${subject} looks like`,
      `Choose one small step toward ${subject}`,
    ],
    nextAction: {
      title: `List possible first steps for ${subject}`,
      durationMinutes: 15,
      day: '',
      details: 'A short planning block. Edit this to a more specific action when you know it.',
    },
  }
}

export function normalizeGoalBreakdown(input, title) {
  const starter = starterGoalBreakdown(title)
  const rawMilestones = Array.isArray(input?.milestones) ? input.milestones : []
  const milestones = [...new Set(rawMilestones.map(value => clean(typeof value === 'string' ? value : value?.title)).filter(Boolean))].slice(0, 4)
  const rawAction = input?.nextAction || {}
  const duration = Math.round(Number(rawAction.durationMinutes))
  return {
    summary: clean(input?.summary) || starter.summary,
    milestones: milestones.length ? milestones : starter.milestones,
    nextAction: {
      title: clean(rawAction.title) || starter.nextAction.title,
      durationMinutes: Number.isFinite(duration) ? Math.max(10, Math.min(180, duration)) : 15,
      day: DAYS.includes(rawAction.day) ? rawAction.day : '',
      details: clean(rawAction.details),
    },
  }
}
