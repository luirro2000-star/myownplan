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
          priority: { type: 'integer', minimum: 1, maximum: 4 },
          deadlineDay: { type: 'string' },
          splittable: { type: 'boolean' },
          minBlockMinutes: { type: 'integer', minimum: 0 },
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

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })

  const { message, state, selectedDay, now } = await req.json()
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: message }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: responseSchema } },
    }),
  })

  if (!response.ok) return Response.json({ error: 'Anthropic request failed', details: await response.text() }, { status: 502 })
  const data = await response.json()
  const text = data.content?.find((block) => block.type === 'text')?.text
  if (!text) return Response.json({ error: 'No structured response returned.' }, { status: 502 })
  return new Response(text, { headers: { 'content-type': 'application/json' } })
}

export const config = { path: '/api/assistant' }
