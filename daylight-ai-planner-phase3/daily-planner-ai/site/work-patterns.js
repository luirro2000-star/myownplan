import { durationTitleKey } from './duration-learning.js'

const WINDOWS = {
  morning: { start: '07:00', end: '12:00' },
  afternoon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '22:30' },
}

function timeBand(time) {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return ''
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  if (minutes >= 420 && minutes < 720) return 'morning'
  if (minutes >= 720 && minutes < 1080) return 'afternoon'
  if (minutes >= 1080 && minutes < 1350) return 'evening'
  return ''
}

export function workPattern(workLog, title, choices = [], currentWindow = null) {
  const titleKey = durationTitleKey(title)
  if (!titleKey) return null
  const attempts = (Array.isArray(workLog) ? workLog : []).filter(entry => durationTitleKey(entry.title) === titleKey && ['completed', 'skipped'].includes(entry.outcome)).slice(-10)
  if (attempts.length < 3) return null
  const completed = attempts.filter(entry => entry.outcome === 'completed')
  const skipped = attempts.length - completed.length
  const bands = completed.map(entry => timeBand(entry.plannedStart)).filter(Boolean)
  let preferred = null
  if (bands.length >= 3) {
    const counts = Object.fromEntries(Object.keys(WINDOWS).map(band => [band, bands.filter(value => value === band).length]))
    const [band, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (count >= 3 && count / bands.length >= 2 / 3) {
      const window = WINDOWS[band]
      const ignored = (choices || []).some(choice => choice.titleKey === titleKey && choice.band === band && choice.status === 'ignored')
      const alreadyPreferred = currentWindow?.start === window.start && currentWindow?.end === window.end
      if (!ignored && !alreadyPreferred) preferred = { band, window, sampleCount: count, titleKey }
    }
  }
  return { attempts: attempts.length, completed: completed.length, skipped, preferred }
}
