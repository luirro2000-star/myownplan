import { getUser, verifyRequestOrigin } from '@netlify/identity'

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    milestones: { type: 'array', items: { type: 'string' } },
    nextAction: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        durationMinutes: { type: 'integer' },
        day: { type: 'string' },
        details: { type: 'string' },
      },
      required: ['title', 'durationMinutes', 'day', 'details'],
    },
  },
  required: ['summary', 'milestones', 'nextAction'],
}

export async function handleGoalBreakdown(req, { currentUser = getUser, checkOrigin = verifyRequestOrigin, provider = fetch } = {}) {
  if (req.method !== 'POST') return Response.json({ code: 'method_not_allowed' }, { status: 405 })
  if (!(await currentUser())?.id) return Response.json({ code: 'unauthorized', error: 'Sign in for AI suggestions.' }, { status: 401 })
  try { checkOrigin(req) } catch { return Response.json({ code: 'invalid_origin' }, { status: 403 }) }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ code: 'missing_key' }, { status: 503 })

  let input
  try { input = await req.json() } catch { return Response.json({ code: 'invalid_json' }, { status: 400 }) }
  const title = String(input?.title || '').trim()
  const details = String(input?.details || '').trim()
  if (!title || title.length > 240 || details.length > 2000 || !['goal', 'open_loop'].includes(input?.kind)) return Response.json({ code: 'invalid_goal' }, { status: 400 })

  const system = `You help turn a personal goal or vague intention into a reviewable roadmap for Daylight.
Return two to four short milestones and exactly one concrete next action. The action must be small enough to start in one 10–180 minute block. Use an empty day unless the user's details clearly specify a weekday. Never invent a deadline or promise that a goal will be completed. Do not place anything on the calendar: the user reviews the proposal and Daylight's deterministic scheduler decides placement. Preserve room for rest and free time. Keep the explanation encouraging and concise.`
  let response
  try {
    response = await provider('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1600,
        system,
        messages: [{ role: 'user', content: JSON.stringify({ kind: input.kind, title, details }) }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: responseSchema } },
      }),
    })
  } catch { return Response.json({ code: 'provider_unreachable' }, { status: 502 }) }
  if (!response.ok) {
    console.error('Goal breakdown failed', response.status)
    return Response.json({ code: 'provider_request' }, { status: response.status === 429 ? 429 : 502 })
  }
  let data
  try { data = await response.json() } catch { return Response.json({ code: 'provider_response' }, { status: 502 }) }
  const output = data.content?.find(block => block.type === 'text')?.text
  if (!output) return Response.json({ code: 'provider_response' }, { status: 502 })
  try { return Response.json(JSON.parse(output), { headers: { 'cache-control': 'no-store' } }) }
  catch { return Response.json({ code: 'provider_response' }, { status: 502 }) }
}

export default req => handleGoalBreakdown(req)
export const config = { path: '/api/goal-breakdown' }
