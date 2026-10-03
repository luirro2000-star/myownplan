import { DAYS, toMinutes } from './planner-engine.js'

export const DAY_MODES = ['minimum', 'normal', 'ambitious']
export const MODE_LABELS = { minimum: 'Minimum', normal: 'Normal', ambitious: 'Ambitious' }
export const MODE_HINTS = {
  minimum: 'Keep more breathing room for the essentials.',
  normal: 'A balanced plan with an extra hour open.',
  ambitious: 'Use more available time while protecting your free-time floor.',
}

export function modeForDay(modes, day) {
  return DAY_MODES.includes(modes?.[day]) ? modes[day] : 'normal'
}

export function configForDayModes(config, modes = {}) {
  const span = Math.max(0, (toMinutes(config.dayEnd) ?? 1350) - (toMinutes(config.dayStart) ?? 420))
  const protectedFreeMinutes = { ...config.protectedFreeMinutes }
  for (const day of DAYS) {
    const floor = Math.max(0, Number(config.protectedFreeMinutes?.[day]) || 0)
    const extra = modeForDay(modes, day) === 'minimum' ? 180 : modeForDay(modes, day) === 'normal' ? 60 : 0
    protectedFreeMinutes[day] = Math.min(span, floor + extra)
  }
  return { ...config, protectedFreeMinutes }
}
