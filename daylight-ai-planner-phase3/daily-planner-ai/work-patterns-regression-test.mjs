import assert from 'node:assert/strict'
import { workPattern } from './site/work-patterns.js'
import { planWeek } from './site/planner-engine.js'

const completed = (time, title = 'Homework') => ({ title, outcome: 'completed', plannedStart: time })
const skipped = (time, title = 'Homework') => ({ title, outcome: 'skipped', plannedStart: time })
const history = [completed('16:00'), completed('16:30'), skipped('14:00'), completed('17:00')]
assert.equal(workPattern(history.slice(0, 2), 'Homework'), null)
const pattern = workPattern(history, ' homework ')
assert.deepEqual({ attempts: pattern.attempts, completed: pattern.completed, skipped: pattern.skipped }, { attempts: 4, completed: 3, skipped: 1 })
assert.equal(pattern.preferred.band, 'afternoon')
assert.deepEqual(pattern.preferred.window, { start: '12:00', end: '18:00' })
assert.equal(workPattern(history, 'Homework', [{ titleKey: 'homework', band: 'afternoon', status: 'ignored' }]).preferred, null)
assert.equal(workPattern(history, 'Homework', [], { start: '12:00', end: '18:00' }).preferred, null)
assert.equal(workPattern([completed('09:00'), completed('16:00'), completed('19:00')], 'Homework').preferred, null)
assert.equal(workPattern([completed('16:00'), completed('16:00'), skipped('16:00')], 'Homework').preferred, null)
assert.equal(workPattern([completed('16:00', 'Other'), completed('16:00', 'Other'), completed('16:00', 'Other')], 'Homework'), null)

const config = { dayStart: '07:00', dayEnd: '22:00', protectedFreeMinutes: { Monday: 60 }, transitionMinutes: 0 }
const items = [
  { id: 'fixed', title: 'Class', day: 'Monday', start: '12:00', end: '14:00', durationMinutes: 120, flexible: false, locked: true },
  { id: 'work', title: 'Homework', day: 'Monday', start: '', end: '', durationMinutes: 90, flexible: true, preferredWindow: pattern.preferred.window },
]
const planned = planWeek(items, config, { startDay: 'Monday' })
const work = planned.items.find(item => item.id === 'work')
assert.equal(work.start, '14:00')
assert.equal(planned.items.find(item => item.id === 'fixed').start, '12:00')
console.log('WORK_PATTERNS_REGRESSION_TEST_PASS')
