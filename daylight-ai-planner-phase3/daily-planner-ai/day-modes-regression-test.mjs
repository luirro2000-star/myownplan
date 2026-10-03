import assert from 'node:assert/strict'
import { configForDayModes, modeForDay } from './site/day-modes.js'
import { planWeek } from './site/planner-engine.js'

const base = { dayStart: '07:00', dayEnd: '10:00', protectedFreeMinutes: { Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30, Friday: 30 }, transitionMinutes: 0 }
assert.equal(modeForDay({}, 'Monday'), 'normal')
assert.equal(configForDayModes(base, { Monday: 'minimum' }).protectedFreeMinutes.Monday, 180)
assert.equal(configForDayModes(base, { Monday: 'normal' }).protectedFreeMinutes.Monday, 90)
assert.equal(configForDayModes(base, { Monday: 'ambitious' }).protectedFreeMinutes.Monday, 30)
assert.equal(configForDayModes(base, { Monday: 'invalid' }).protectedFreeMinutes.Monday, 90)

const items = [
  { id: 'fixed', title: 'Class', day: 'Monday', start: '07:00', end: '08:00', durationMinutes: 60, kind: 'event', locked: true, flexible: false },
  { id: 'work', title: 'Work', day: 'Monday', start: '', end: '', durationMinutes: 90, kind: 'task', flexible: true, deadlineDay: 'Monday', priority: 2 },
]
const normal = planWeek(items, configForDayModes(base, { Monday: 'normal' }), { startDay: 'Monday' })
const ambitious = planWeek(items, configForDayModes(base, { Monday: 'ambitious' }), { startDay: 'Monday' })
assert.equal(normal.items.find(item => item.id === 'work').unscheduled, true)
assert.equal(ambitious.items.find(item => item.id === 'work').start, '08:00')
assert.equal(ambitious.items.find(item => item.id === 'fixed').start, '07:00')
assert.equal(ambitious.diagnostics.byDay.Monday.protectedFreeMinutes, 30)
console.log('DAY_MODES_REGRESSION_TEST_PASS')
