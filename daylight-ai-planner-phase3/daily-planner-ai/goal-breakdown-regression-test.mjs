import assert from 'node:assert/strict'
import { normalizeGoalBreakdown, starterGoalBreakdown } from './site/goal-breakdown.js'
import { handleGoalBreakdown } from './netlify/functions/goal-breakdown.mjs'

const starter = starterGoalBreakdown('Build a portfolio')
assert.equal(starter.nextAction.durationMinutes, 15)
assert.equal(starter.nextAction.day, '')

const normalized = normalizeGoalBreakdown({
  summary: 'Choose a direction',
  milestones: ['Pick a theme', 'Pick a theme', 'Select three projects'],
  nextAction: { title: 'List possible themes', durationMinutes: 500, day: 'Someday', details: 'Keep it small' },
}, 'Build a portfolio')
assert.deepEqual(normalized.milestones, ['Pick a theme', 'Select three projects'])
assert.equal(normalized.nextAction.durationMinutes, 180)
assert.equal(normalized.nextAction.day, '')

let calls = 0
const request = body => new Request('https://example.net/api/goal-breakdown', { method: 'POST', body: JSON.stringify(body) })
const goal = { kind: 'goal', title: 'Build a portfolio', details: 'I want three strong projects.' }
const unsigned = await handleGoalBreakdown(request(goal), { currentUser: async () => null, checkOrigin: () => {}, provider: async () => { calls++; throw Error('provider should not run') } })
assert.equal(unsigned.status, 401)
assert.equal(calls, 0)

const oldKey = process.env.ANTHROPIC_API_KEY
process.env.ANTHROPIC_API_KEY = 'test-key'
try {
  const invalid = await handleGoalBreakdown(request({ ...goal, title: '' }), { currentUser: async () => ({ id: 'user-1' }), checkOrigin: () => {}, provider: async () => { calls++; throw Error('provider should not run') } })
  assert.equal(invalid.status, 400)
  const crossOrigin = await handleGoalBreakdown(request(goal), { currentUser: async () => ({ id: 'user-1' }), checkOrigin: () => { throw Error('bad origin') } })
  assert.equal(crossOrigin.status, 403)

  const result = await handleGoalBreakdown(request(goal), {
    currentUser: async () => ({ id: 'user-1' }),
    checkOrigin: () => {},
    provider: async (_url, options) => {
      calls++
      const sent = JSON.parse(options.body)
      assert.equal(sent.messages[0].role, 'user')
      assert.equal(sent.output_config.format.type, 'json_schema')
      return Response.json({ content: [{ type: 'text', text: JSON.stringify({ summary: 'A small start', milestones: ['Pick a theme'], nextAction: { title: 'List themes', durationMinutes: 20, day: '', details: '' } }) }] })
    },
  })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).nextAction.title, 'List themes')
  assert.equal(calls, 1)
} finally {
  if (oldKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = oldKey
}

console.log('GOAL_BREAKDOWN_REGRESSION_TEST_PASS')
