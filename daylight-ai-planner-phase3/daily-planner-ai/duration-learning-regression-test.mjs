import assert from 'node:assert/strict'
import { durationSuggestion } from './site/duration-learning.js'

const record = (title, actualMinutes) => ({ title, actualMinutes, outcome: 'completed' })
const log = [record('Homework', 45), record('homework ', 50), record('Homework', 180), { title: 'Homework', outcome: 'skipped' }, record('Gym', 120)]
assert.equal(durationSuggestion(log.slice(0, 1), 'Homework', 90), null)
const suggestion = durationSuggestion(log, ' HOMEWORK ', 90)
assert.deepEqual(suggestion, { titleKey: 'homework', suggestedMinutes: 50, sampleCount: 3 })
assert.equal(durationSuggestion(log, 'Homework', 55), null)
assert.equal(durationSuggestion(log, 'Homework', 90, [{ titleKey: 'homework', suggestedMinutes: 50, status: 'ignored' }]), null)
assert.equal(durationSuggestion(log, 'Gym', 90), null)
console.log('DURATION_LEARNING_REGRESSION_TEST_PASS')
