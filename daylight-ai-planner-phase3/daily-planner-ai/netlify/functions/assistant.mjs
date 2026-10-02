import { getUser } from '@netlify/identity'

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['create', 'move', 'update', 'complete', 'rule', 'goal', 'replan'] },
          targetId: { type: 'string' },
          title: { type: 'string' },
          day: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          durationMinutes: { type: 'integer' },
          kind: { type: 'string', enum: ['event', 'task', 'routine', 'reflection', 'buffer'] },
          details: { type: 'string' },
          priority: { type: 'integer' },
          deadlineDay: { type: 'string' },
          splittable: { type: 'boolean' },
          minBlockMinutes: { type: 'integer' },
          preferredStart: { type: 'string' },
          preferredEnd: { type: 'string' },
        },
        required: ['action','targetId','title','day','start','end','durationMinutes','kind','details','priority','deadlineDay','splittable','minBlockMinutes','preferredStart','preferredEnd'],
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply','proposals','questions'],
}

export async function handleAssistant(req, { currentUser = getUser } = {}) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  if (!(await currentUser())?.id) return Response.json({ code: 'unauthorized', error: 'Sign in to use the AI planner.' }, { status: 401 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ code: 'missing_key', error: 'The AI key is missing from the Functions environment.' }, { status: 503 })

  let input
  try { input = await req.json() } catch { return Response.json({ code: 'invalid_request', error: 'Expected JSON.' }, { status: 400 }) }
  const { message, state, selectedDay, now, history } = input || {}
  if (!String(message || '').trim()) return Response.json({ code: 'invalid_request', error: 'Message is empty.' }, { status: 400 })
  const conversation = []
  for (const turn of Array.isArray(history) ? history.slice(-8) : []) {
    if (!['user','assistant'].includes(turn?.role) || typeof turn.text !== 'string') continue
    const content = turn.text.trim().slice(0,2000)
    if (!content) continue
    if (!conversation.length && turn.role === 'assistant') continue
    if (conversation.at(-1)?.role === turn.role) conversation.at(-1).content += `\n${content}`
    else conversation.push({ role: turn.role, content })
  }
  if (conversation.at(-1)?.role === 'user') conversation.at(-1).content += `\n${String(message).trim()}`
  else conversation.push({ role: 'user', content: String(message).trim() })
  const system = `You are the interpretation layer for Daylight, a conversational daily planner.
Understand messy human planning language and propose safe, concrete modifications to structured planning data.

Rules:
- Distinguish fixed events, flexible tasks, routines, goals, rules, reflections, metrics, and vague/open-loop intentions.
- Never turn every intention into a calendar event.
- Preserve fixed commitments unless the user explicitly asks to change them.
- Preserve intentional free time. Do not pack every open minute.
- If a time is materially ambiguous, ask one short question rather than silently deciding.
- When the day went wrong, plan forward from now; do not try to repair the past.
- Use 24-hour HH:MM for start/end. Use empty strings when a time is not appropriate.
- For flexible tasks, prefer giving duration/deadline/priority/preferences and leave exact start/end empty unless the user explicitly fixes that time. The deterministic planner will place it.
- priority is 1 low, 2 normal, 3 high, 4 critical. deadlineDay is a weekday or empty. splittable means the work can be broken into multiple blocks.
- preferredStart/preferredEnd define a soft time window and may be empty.
- Use exact existing IDs for move/complete. Other operations use targetId="".
- Keep the reply concise and human, emphasizing tradeoffs.
- Ask only questions that materially block a useful plan.

Selected day: ${selectedDay}
Current client time: ${now}
Planner state: ${JSON.stringify(state)}`

  let response
  try { response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 1800,
      system,
      messages: conversation,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: responseSchema } },
    }),
  }) } catch {
    return Response.json({ code: 'provider_unreachable', error: 'The AI provider could not be reached.' }, { status: 502 })
  }

  if (!response.ok) {
    let providerError = {}
    try { providerError = await response.json() } catch { /* Keep the status even if the provider response is not JSON. */ }
    console.error('Anthropic request failed', response.status, providerError?.error?.type || 'unknown')
    const code = response.status === 401 || response.status === 403 ? 'provider_auth'
      : response.status === 402 ? 'provider_balance'
      : response.status === 404 ? 'provider_model'
      : response.status === 429 ? 'provider_rate_limit' : 'provider_request'
    return Response.json({ code, error: 'The AI provider could not process the request.' }, { status: response.status === 429 ? 429 : 502 })
  }
  let data
  try { data = await response.json() } catch { return Response.json({ code: 'provider_response', error: 'The AI provider returned unreadable data.' }, { status: 502 }) }
  const text = data.content?.find((block) => block.type === 'text')?.text
  if (!text) return Response.json({ code: 'provider_response', error: 'No structured response returned.' }, { status: 502 })
  return new Response(text, { headers: { 'content-type': 'application/json' } })
}

export default req => handleAssistant(req)
export const config = { path: '/api/assistant' }
