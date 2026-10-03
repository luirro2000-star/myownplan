import assert from 'node:assert/strict'
import { captureQuestions, resolveQuestion, describeOperation } from './site/planning-memory.js'

let sequence = 0
const options = { idFactory: () => `question-${++sequence}`, now: '2026-10-02T12:00:00Z' }
const first = captureQuestions([], ['Which day works?', 'Which day works?', 'How long will it take?'], options)
assert.equal(first.length, 2)
assert.equal(first[0].status, 'pending')
const second = captureQuestions(first, [' which day works? ', 'What should happen first?'], options)
assert.equal(second.length, 3)
const answered = resolveQuestion(second, first[0].id, 'answered', '2026-10-02T13:00:00Z')
assert.equal(answered[0].status, 'answered')
assert.equal(answered[1].status, 'pending')
assert.equal(captureQuestions(answered, ['Which day works?'], options).length, 4)

const before = { items: [{ id: 'one', title: 'Draft', completed: false }], goals: [], openLoops: [], rules: [], inbox: [], questions: first }
const after = { ...before, items: [{ id: 'one', title: 'Draft', completed: true }, { id: 'two', title: 'Review' }], questions: answered }
const summary = describeOperation(before, after)
assert.match(summary, /planner blocks added/)
assert.match(summary, /planner blocks updated/)
assert.match(summary, /questions updated/)
console.log('PLANNING_MEMORY_REGRESSION_TEST_PASS')
