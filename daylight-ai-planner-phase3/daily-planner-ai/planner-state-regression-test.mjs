import assert from 'node:assert/strict'
import { handlePlannerState } from './netlify/functions/planner-state.mjs'

const rows = new Map()
const snapshots = []
const database = () => ({
  sql: async (strings, userId) => {
    if (strings[0].startsWith('SELECT')) return rows.has(userId) ? [rows.get(userId)] : []
    if (strings[0].startsWith('DELETE')) { rows.delete(userId); return [] }
    throw new Error('Unexpected SQL')
  },
  pool: { connect: async () => ({
    query: async (sql, params = []) => {
      if (sql.startsWith('SELECT revision')) return { rows: rows.has(params[0]) ? [{ revision: rows.get(params[0]).revision }] : [] }
      if (sql.startsWith('INSERT INTO daylight_planners')) rows.set(params[0], { revision: params[1], planner: JSON.parse(params[2]), undo_history: JSON.parse(params[3]), conversation: JSON.parse(params[4]) })
      if (sql.startsWith('INSERT INTO daylight_snapshots')) snapshots.push({ userId: params[0], revision: params[1] })
      return { rows: [] }
    },
    release() {},
  }) },
})
const config = { currentUser: async () => ({ id: 'owner' }), database, checkOrigin: req => { if (req.headers.get('origin') !== 'https://daylight.test') throw new Error('Invalid origin') } }
const planner = { version:3, items:[], goals:[], rules:[], inbox:[] }
const request = (method, body, origin = 'https://daylight.test') => new Request('https://daylight.test/api/planner-state', { method, headers: { origin, 'content-type':'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })

assert.equal((await handlePlannerState(request('GET'), { ...config, currentUser: async () => null })).status, 401)
assert.equal((await handlePlannerState(request('PUT', {}), config)).status, 400)
assert.equal((await handlePlannerState(request('PUT', { state: planner, history: [], conversation: [], expectedRevision: 0 }, 'https://other.test'), config)).status, 403)
const first = await handlePlannerState(request('PUT', { state: planner, history: [], conversation: [], expectedRevision: 0 }), config)
assert.equal(first.status, 200)
assert.equal((await first.json()).revision, 1)
assert.equal(snapshots.length, 1)
const read = await handlePlannerState(request('GET'), config)
assert.equal((await read.json()).state.version, 3)
assert.equal((await handlePlannerState(request('GET'), { ...config, currentUser: async () => ({ id: 'other' }) })).status, 200)
const conflict = await handlePlannerState(request('PUT', { state: planner, history: [], conversation: [], expectedRevision: 0 }), config)
assert.equal(conflict.status, 409)
const forced = await handlePlannerState(request('PUT', { state: planner, history: [], conversation: [], expectedRevision: 0, force: true }), config)
assert.equal((await forced.json()).revision, 2)
const deleted = await handlePlannerState(request('DELETE'), config)
assert.equal(deleted.status, 200)
assert.equal((await (await handlePlannerState(request('GET'), config)).json()).exists, false)
console.log('PLANNER_STATE_REGRESSION_TEST_PASS')
