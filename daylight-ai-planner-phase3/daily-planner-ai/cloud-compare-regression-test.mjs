import assert from 'node:assert/strict'
import { sameCloudPayload } from './site/cloud-compare.js'

const browserCopy = {
  state: { items: [{ id: 'one', title: 'Plan', details: { start: '09:00', end: '10:00' } }], goals: [] },
  history: [{ label: 'Saved plan', state: { items: [], goals: [] } }],
  conversation: [{ id: 'hi', role: 'assistant', text: 'Ready', error: false }],
}
const databaseCopy = {
  conversation: [{ text: 'Ready', error: false, role: 'assistant', id: 'hi' }],
  history: [{ state: { goals: [], items: [] }, label: 'Saved plan' }],
  state: { goals: [], items: [{ title: 'Plan', details: { end: '10:00', start: '09:00' }, id: 'one' }] },
}

assert.equal(sameCloudPayload(browserCopy, databaseCopy), true, 'JSONB key order must not cause a false conflict')
databaseCopy.state.items[0].details.end = '11:00'
assert.equal(sameCloudPayload(browserCopy, databaseCopy), false, 'a changed plan must still require a choice')
databaseCopy.state.items[0].details.end = '10:00'
databaseCopy.conversation[0].text = 'Different answer'
assert.equal(sameCloudPayload(browserCopy, databaseCopy), false, 'different conversation history must not be overwritten silently')
console.log('CLOUD_COMPARE_REGRESSION_TEST_PASS')
