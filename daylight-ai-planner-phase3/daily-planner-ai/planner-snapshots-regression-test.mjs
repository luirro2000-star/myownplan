import assert from 'node:assert/strict'
import { handlePlannerSnapshots } from './netlify/functions/planner-snapshots.mjs'

const oldPlan = { version: 3, items: [], goals: [{ id: 'old', title: 'Old goal' }], rules: [], inbox: [] }
const currentPlan = { version: 3, items: [], goals: [{ id: 'current', title: 'Current goal' }], rules: [], inbox: [] }
const rows = new Map([['owner', { revision: 3, planner: currentPlan, history: [] }]])
const snapshots = [
  { userId: 'owner', revision: 1, planner: oldPlan, label: 'Old goal', created_at: '2026-10-01T12:00:00Z' },
  { userId: 'owner', revision: 3, planner: currentPlan, label: 'Current goal', created_at: '2026-10-02T12:00:00Z' },
  { userId: 'other', revision: 2, planner: { ...oldPlan, goals: [] }, label: 'Private', created_at: '2026-10-02T11:00:00Z' },
]
const database = () => ({
  sql: async (_strings, userId) => snapshots.filter(row => row.userId === userId).sort((a, b) => b.revision - a.revision).map(({ revision, label, created_at }) => ({ revision, label, created_at })),
  pool: { connect: async () => ({
    query: async (sql, params = []) => {
      if (sql.startsWith('SELECT revision FROM daylight_planners')) return { rows: rows.has(params[0]) ? [{ revision: rows.get(params[0]).revision }] : [] }
      if (sql.startsWith('SELECT planner FROM daylight_snapshots')) return { rows: snapshots.filter(row => row.userId === params[0] && row.revision === params[1]).map(row => ({ planner: row.planner })) }
      if (sql.startsWith('UPDATE daylight_planners')) rows.set(params[0], { revision: params[1], planner: JSON.parse(params[2]), history: JSON.parse(params[3]) })
      if (sql.startsWith('INSERT INTO daylight_snapshots')) snapshots.push({ userId: params[0], revision: params[1], planner: JSON.parse(params[2]), label: params[3] })
      return { rows: [] }
    },
    release() {},
  }) },
})
const config = { currentUser: async () => ({ id: 'owner' }), database, checkOrigin: req => { if (req.headers.get('origin') !== 'https://daylight.test') throw Error('Invalid origin') } }
const request = (method, body, origin = 'https://daylight.test') => new Request('https://daylight.test/api/planner-snapshots', { method, headers: { origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })

assert.equal((await handlePlannerSnapshots(request('GET'), { ...config, currentUser: async () => null })).status, 401)
const list = await handlePlannerSnapshots(request('GET'), config)
assert.deepEqual((await list.json()).snapshots.map(row => row.revision), [3, 1])
assert.equal((await handlePlannerSnapshots(request('POST', { revision: 1, expectedRevision: 3, history: [] }, 'https://other.test'), config)).status, 403)
assert.equal((await handlePlannerSnapshots(request('POST', { revision: 1, expectedRevision: 2, history: [] }), config)).status, 409)
assert.equal((await handlePlannerSnapshots(request('POST', { revision: 2, expectedRevision: 3, history: [] }), config)).status, 404)
const history = [{ label: 'Before restore', at: '2026-10-02T13:00:00Z', state: currentPlan }]
const restored = await handlePlannerSnapshots(request('POST', { revision: 1, expectedRevision: 3, history }), config)
assert.equal(restored.status, 200)
assert.equal((await restored.json()).revision, 4)
assert.deepEqual(rows.get('owner').planner, oldPlan)
assert.deepEqual(rows.get('owner').history, history)
assert.equal(snapshots.find(row => row.userId === 'owner' && row.revision === 4).label, 'Restored version 1')
console.log('PLANNER_SNAPSHOTS_REGRESSION_TEST_PASS')
