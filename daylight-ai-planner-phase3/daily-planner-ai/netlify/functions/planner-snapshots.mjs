import { getDatabase } from '@netlify/database'
import { getUser, verifyRequestOrigin } from '@netlify/identity'

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
const validPlanner = state => state && typeof state === 'object' && Array.isArray(state.items) && Array.isArray(state.rules) && Array.isArray(state.goals) && Array.isArray(state.inbox) && state.items.length <= 5000
const validHistory = value => Array.isArray(value) && value.length <= 20 && value.every(entry => entry && typeof entry.label === 'string' && typeof entry.at === 'string' && validPlanner(entry.state))

export async function handlePlannerSnapshots(req, { currentUser = getUser, database = getDatabase, checkOrigin = verifyRequestOrigin } = {}) {
  const user = await currentUser()
  if (!user?.id) return json({ code: 'unauthorized' }, 401)
  if (!['GET', 'POST'].includes(req.method)) return json({ code: 'method_not_allowed' }, 405)

  const db = database()
  if (req.method === 'GET') {
    try {
      const rows = await db.sql`SELECT revision, label, created_at FROM daylight_snapshots WHERE user_id = ${user.id} ORDER BY revision DESC LIMIT 20`
      return json({ snapshots: rows.map(row => ({ revision: Number(row.revision), label: row.label, createdAt: row.created_at })) })
    } catch (error) {
      console.error('Snapshot list failed', error)
      return json({ code: 'storage_unavailable' }, 503)
    }
  }

  try { checkOrigin(req) } catch { return json({ code: 'invalid_origin' }, 403) }
  let input
  try {
    const raw = await req.text()
    if (raw.length > 1_000_000) return json({ code: 'too_large' }, 413)
    input = JSON.parse(raw)
  } catch { return json({ code: 'invalid_json' }, 400) }
  if (!Number.isSafeInteger(input?.revision) || input.revision < 1 || !Number.isSafeInteger(input?.expectedRevision) || input.expectedRevision < 1 || !validHistory(input.history)) return json({ code: 'invalid_restore' }, 400)

  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id])
    const current = await client.query('SELECT revision FROM daylight_planners WHERE user_id = $1 FOR UPDATE', [user.id])
    if (!current.rows.length) {
      await client.query('ROLLBACK')
      return json({ code: 'missing_plan' }, 404)
    }
    const currentRevision = Number(current.rows[0].revision)
    if (currentRevision !== input.expectedRevision) {
      await client.query('ROLLBACK')
      return json({ code: 'conflict', revision: currentRevision }, 409)
    }
    const found = await client.query('SELECT planner FROM daylight_snapshots WHERE user_id = $1 AND revision = $2', [user.id, input.revision])
    if (!found.rows.length) {
      await client.query('ROLLBACK')
      return json({ code: 'missing_snapshot' }, 404)
    }
    const planner = found.rows[0].planner
    const nextRevision = currentRevision + 1
    const label = `Restored version ${input.revision}`
    await client.query(`UPDATE daylight_planners SET revision = $2, planner = $3::jsonb, undo_history = $4::jsonb, updated_at = now() WHERE user_id = $1`,
      [user.id, nextRevision, JSON.stringify(planner), JSON.stringify(input.history)])
    await client.query('INSERT INTO daylight_snapshots (user_id, revision, planner, label) VALUES ($1, $2, $3::jsonb, $4)',
      [user.id, nextRevision, JSON.stringify(planner), label])
    await client.query(`DELETE FROM daylight_snapshots WHERE user_id = $1 AND id NOT IN
      (SELECT id FROM daylight_snapshots WHERE user_id = $1 ORDER BY revision DESC LIMIT 20)`, [user.id])
    await client.query('COMMIT')
    return json({ restored: true, revision: nextRevision, state: planner })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Snapshot restore failed', error)
    return json({ code: 'storage_unavailable' }, 503)
  } finally { client.release() }
}

export default req => handlePlannerSnapshots(req)
export const config = { path: '/api/planner-snapshots' }
