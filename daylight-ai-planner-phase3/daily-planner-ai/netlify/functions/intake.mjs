const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']

const entryProperties = {
  reviewId: { type: 'string' },
  type: { type: 'string', enum: ['event','task','routine','rule','goal','metric','open_loop'] },
  title: { type: 'string' },
  sourceText: { type: 'string' },
  day: { type: 'string' },
  start: { type: 'string' },
  end: { type: 'string' },
  durationMinutes: { type: 'integer', minimum: 0 },
  recurrence: { type: 'string', enum: ['once','daily','weekdays','weekly','custom'] },
  priority: { type: 'integer', minimum: 1, maximum: 4 },
  details: { type: 'string' },
  target: { type: 'number' },
  unit: { type: 'string' },
  deadlineDay: { type: 'string' },
  preferredStart: { type: 'string' },
  preferredEnd: { type: 'string' },
  splittable: { type: 'boolean' },
  minBlockMinutes: { type: 'integer', minimum: 0 },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  needsConfirmation: { type: 'boolean' },
  question: { type: 'string' },
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    understood: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: entryProperties,
        required: Object.keys(entryProperties),
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary','understood','questions'],
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })

  const { text, state, now } = await req.json()
  if (!String(text || '').trim()) return Response.json({ error: 'Brain dump is empty.' }, { status: 400 })

  const system = `You are the intake interpreter for Daylight, a conversational life planner.
The user will paste messy notes about their schedule, responsibilities, habits, goals, rules, metrics, worries, and vague intentions. Convert the notes into reviewable planning objects without prematurely forcing everything onto a calendar.

Object types:
- event: a fixed commitment at a specific day/time, such as class, appointment, work shift.
- task: concrete work that needs to happen but can usually move.
- routine: a repeated concrete behavior, usually daily/weekday/weekly.
- rule: a planning preference or conditional constraint, such as bedtime logic or arriving early.
- goal: an outcome or repeated target that should later produce next actions.
- metric: something numeric the user wants to track, such as points or glasses of water.
- open_loop: meaningful but still too ambiguous to schedule or decompose safely.

Interpretation rules:
- Preserve the meaning and wording of the user's original notes in sourceText.
- Do not convert every sentence into an event.
- Prefer open_loop over inventing details.
- If an item is ambiguous but still useful, classify it, set needsConfirmation=true, and ask one concise question in question.
- Ask only questions that materially affect planning. Do not ask for harmless details the scheduler can decide later.
- For times, output 24-hour HH:MM. Empty string means unknown/not applicable.
- Never guess AM vs PM when both are materially plausible. A known pattern in existing state may raise confidence, but do not silently overwrite a real ambiguity.
- For a time with no end, leave end empty and use durationMinutes only if the duration is explicitly stated or strongly implied by an existing rule.
- recurrence is once, daily, weekdays, weekly, or custom.
- priority: 1 low, 2 normal, 3 high, 4 critical. Use 2 when not stated.
- For tasks, give duration/deadline/preferences when supported, but leave exact start/end empty unless the user fixed the time.
- For goals/metrics, target is numeric if stated, otherwise 0. unit is a short noun such as sessions, hours, points.
- details should capture planning meaning not represented by other fields.
- confidence reflects confidence in the classification and extracted facts, not whether the goal will succeed.
- reviewId must be a short unique string like intake-1.
- Avoid duplicates when the pasted text repeats the same statement.
- Existing planner state is context only. Do not return updates to existing objects unless the pasted text clearly adds new information; focus on what this brain dump contains.

Current local timestamp: ${now || ''}
Supported schedule weekdays: ${days.join(', ')}
Existing planner state: ${JSON.stringify(state || {})}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 4200,
      system,
      messages: [{ role: 'user', content: String(text) }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: responseSchema } },
    }),
  })

  if (!response.ok) return Response.json({ error: 'Anthropic request failed', details: await response.text() }, { status: 502 })
  const data = await response.json()
  const output = data.content?.find(block => block.type === 'text')?.text
  if (!output) return Response.json({ error: 'No structured intake returned.' }, { status: 502 })
  return new Response(output, { headers: { 'content-type': 'application/json' } })
}

export const config = { path: '/api/intake' }
