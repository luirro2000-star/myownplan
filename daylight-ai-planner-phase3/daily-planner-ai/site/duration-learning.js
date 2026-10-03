export const durationTitleKey = title => String(title || '').trim().toLowerCase().replace(/\s+/g, ' ')

export function durationSuggestion(workLog, title, estimatedMinutes, choices = []) {
  const titleKey = durationTitleKey(title)
  if (!titleKey) return null
  const samples = (Array.isArray(workLog) ? workLog : [])
    .filter(entry => entry.outcome === 'completed' && durationTitleKey(entry.title) === titleKey && Number.isFinite(Number(entry.actualMinutes)) && Number(entry.actualMinutes) >= 5 && Number(entry.actualMinutes) <= 480)
    .slice(-10).map(entry => Number(entry.actualMinutes)).sort((a, b) => a - b)
  if (samples.length < 2) return null
  const middle = Math.floor(samples.length / 2)
  const median = samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2
  const suggestedMinutes = Math.max(5, Math.min(480, Math.round(median / 5) * 5))
  if (Math.abs(suggestedMinutes - Number(estimatedMinutes)) < 10) return null
  if ((choices || []).some(choice => choice.titleKey === titleKey && choice.suggestedMinutes === suggestedMinutes && choice.status === 'ignored')) return null
  return { titleKey, suggestedMinutes, sampleCount: samples.length }
}
