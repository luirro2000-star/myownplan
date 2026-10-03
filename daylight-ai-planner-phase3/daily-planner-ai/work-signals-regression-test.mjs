import assert from 'node:assert/strict'
import { finishWork, reopenWork, skipWork, resumeWork, setActualTime } from './site/work-signals.js'
import { dayMetrics, planWeek } from './site/planner-engine.js'

const config = { dayStart: '07:00', dayEnd: '10:00', protectedFreeMinutes: { Monday: 30 }, transitionMinutes: 0 }
const seed = { items: [
  { id: 'fixed', title: 'Class', day: 'Monday', start: '07:00', end: '08:00', durationMinutes: 60, kind: 'event', flexible: false, locked: true },
  { id: 'work', title: 'Portfolio', day: 'Monday', start: '08:00', end: '09:30', durationMinutes: 90, kind: 'task', flexible: true },
], workLog: [] }

const done = finishWork(seed, 'work', { now: '2026-10-02T12:00:00Z', idFactory: () => 'done-1' })
assert.equal(done.items[1].completed, true)
assert.equal(done.workLog[0].estimatedMinutes, 90)
assert.equal(done.workLog[0].actualMinutes, 90)
assert.equal(done.workLog[0].plannedStart, '08:00')
const measured = setActualTime(done, 'work', 60)
assert.equal(measured.items[1].actualMinutes, 60)
assert.equal(measured.workLog[0].actualMinutes, 60)
assert.equal(setActualTime(measured, 'work', 999).items[1].actualMinutes, 60)
const reopened = reopenWork(measured, 'work')
assert.equal(reopened.items[1].completed, false)
assert.equal(reopened.workLog.length, 0)

const skipped = skipWork(seed, 'work', { now: '2026-10-02T12:00:00Z', idFactory: () => 'skip-1' })
assert.equal(skipped.items[1].start, '')
assert.equal(skipped.workLog[0].outcome, 'skipped')
assert.equal(skipped.workLog[0].plannedStart, '08:00')
assert.equal(dayMetrics(skipped.items, 'Monday', config).flexibleMinutes, 0)
assert.equal(planWeek(skipped.items, config, { startDay: 'Monday' }).items[1].skipped, true)
const resumed = resumeWork(skipped, 'work')
assert.equal(resumed.items[1].skipped, false)
assert.equal(resumed.items[1].unscheduled, true)
assert.equal(resumed.workLog.length, 0)
assert.equal(seed.items[1].skipped, undefined)
console.log('WORK_SIGNALS_REGRESSION_TEST_PASS')
