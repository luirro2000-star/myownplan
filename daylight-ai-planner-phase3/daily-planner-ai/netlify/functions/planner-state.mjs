import { getDatabase } from '@netlify/database'
import { getUser, verifyRequestOrigin } from '@netlify/identity'

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
const validPlanner = state => state && typeof state === 'object' && Array.isArray(state.items) && Array.isArray(state.rules) && Array.isArray(state.goals) && Array.isArray(state.inbox) && state.items.length <= 5000
const validHistory = value => Array.isArray(value) && value.length <= 20 && value.every(entry => entry && typeof entry.label === 'string' && typeof entry.at === 'string' && validPlanner(entry.state))
const validConversation = value => Array.isArray(value) && value.length <= 30 && value.every(turn => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.text === 'string' && turn.text.length <= 4000)

export async function handlePlannerState(req, { currentUser = getUser, database = getDatabase, checkOrigin = verifyRequestOrigin } = {}) {
  const user = await currentUser()
  if (!user?.id) return json({ code: 'unauthorized', error: 'Sign in to sync.' }, 401)
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return json({ code: 'method_not_allowed' }, 405)

  if (req.method !== 'GET') {
    try { checkOrigin(req) } catch { return json({ code: 'invalid_origin' }, 403) }
  }

  const db = database()
  if (req.method === 'GET') {
    const rows = await db.sql`SELECT revision, planner, undo_history, conversation, updated_at FROM daylight_planners WHERE user_id = ${user.id}`
    if (!rows.length) return json({ exists: false })
    const row = rows[0]
    return json({ exists: true, revision: Number(row.revision), state: row.planner, history: row.undo_history, conversation: row.conversation, updatedAt: row.updated_at })
  }

  if (req.method === 'DELETE') {
    await db.sql`DELETE FROM daylight_planners WHERE user_id = ${user.id}`
    return json({ deleted: true })
  }

  let input
  try {
    const raw = await req.text()
    if (raw.length > 1_000_000) return json({ code: 'too_large' }, 413)
    input = JSON.parse(raw)
  } catch { return json({ code: 'invalid_json' }, 400) }
  if (!validPlanner(input?.state) || !validHistory(input?.history) || !validConversation(input?.conversation) || !Number.isSafeInteger(input?.expectedRevision) || input.expectedRevision < 0) return json({ code: 'invalid_state' }, 400)

  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id])
    const { rows } = await client.query('SELECT revision FROM daylight_planners WHERE user_id = $1 FOR UPDATE', [user.id])
    const currentRevision = rows.length ? Number(rows[0].revision) : 0
    if (currentRevision !== input.expectedRevision && !input.force) {
      await client.query('ROLLBACK')
      return json({ code: 'conflict', revision: currentRevision }, 409)
    }
    const nextRevision = currentRevision + 1
    await client.query(`INSERT INTO daylight_planners (user_id, revision, planner, undo_history, conversation, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET revision = EXCLUDED.revision, planner = EXCLUDED.planner,
      undo_history = EXCLUDED.undo_history, conversation = EXCLUDED.conversation, updated_at = now()`,
      [user.id, nextRevision, JSON.stringify(input.state), JSON.stringify(input.history), JSON.stringify(input.conversation)])
    await client.query('INSERT INTO daylight_snapshots (user_id, revision, planner, label) VALUES ($1, $2, $3::jsonb, $4)', [user.id, nextRevision, JSON.stringify(input.state), String(input.label || 'Saved planner').slice(0, 120)])
    await client.query(`DELETE FROM daylight_snapshots WHERE user_id = $1 AND id NOT IN
      (SELECT id FROM daylight_snapshots WHERE user_id = $1 ORDER BY revision DESC LIMIT 20)`, [user.id])
    await client.query('COMMIT')
    return json({ saved: true, revision: nextRevision })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Planner state save failed', error)
    return json({ code: 'storage_unavailable' }, 503)
  } finally { client.release() }
}

export default req => handlePlannerState(req)
export const config = { path: '/api/planner-state' }
