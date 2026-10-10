import { getUser, verifyRequestOrigin } from '@netlify/identity'

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    needsInput: { type: 'boolean' },
    questions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string' }, label: { type: 'string' }, placeholder: { type: 'string' },
    }, required: ['id','label','placeholder'] } },
    title: { type: 'string' },
    summary: { type: 'string' },
    materials: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      title: { type: 'string' }, instruction: { type: 'string' }, durationMinutes: { type: 'integer' }, safetyNote: { type: 'string' },
    }, required: ['title','instruction','durationMinutes','safetyNote'] } },
  },
  required: ['needsInput','questions','title','summary','materials','steps'],
}

const categories = new Set(['cooking','interview','study','project','general'])

export async function handleGuide(req, { currentUser = getUser, checkOrigin = verifyRequestOrigin, provider = fetch } = {}) {
  if (req.method !== 'POST') return Response.json({ code: 'method_not_allowed' }, { status: 405 })
  if (!(await currentUser())?.id) return Response.json({ code: 'unauthorized', error: 'Sign in to build a personalized guide.' }, { status: 401 })
  try { checkOrigin(req) } catch { return Response.json({ code: 'invalid_origin' }, { status: 403 }) }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ code: 'missing_key' }, { status: 503 })

  let input
  try {
    const raw = await req.text()
    if (raw.length > 50_000) return Response.json({ code: 'too_large' }, { status: 413 })
    input = JSON.parse(raw)
  } catch { return Response.json({ code: 'invalid_request' }, { status: 400 }) }
  const title = String(input?.title || '').trim()
  const context = String(input?.context || '').trim()
  const type = categories.has(input?.type) ? input.type : 'general'
  const answers = input?.answers && typeof input.answers === 'object' ? Object.fromEntries(Object.entries(input.answers).slice(0, 8).map(([key,value]) => [String(key).slice(0,80),String(value).slice(0,1200)])) : {}
  if (!title || title.length > 240 || context.length > 4000) return Response.json({ code: 'invalid_guide' }, { status: 400 })

  const system = `You build short, personalized, step-by-step guides for Daylight, a calm daily planner.
The guide must help the person do the activity in the real world, one visible step at a time.

Rules:
- Ask at most four short questions, and only when their answers materially change safety, feasibility, or usefulness.
- If useful context is already present, generate the guide immediately.
- After the user provides answers, generate the guide rather than asking another round unless a critical safety fact is still missing.
- Produce 3–12 ordered steps. Each step needs a concise title, a concrete instruction, and a realistic duration estimate.
- List required materials, ingredients, documents, or equipment separately.
- Keep each step small enough to complete and check off without rereading a long paragraph.
- Never change the person's schedule. The guide supports the selected task only.
- For cooking: account for servings, available ingredients/equipment, allergies, dietary restrictions, and time when relevant. Include exact quantities and essential food-safety temperatures or handling notes. Never guess around a disclosed allergy.
- For interviews: tailor to the role, company, interview stage, available time, and the person's concerns. Do not invent facts about the company.
- For study: ask about subject, assessment, deadline, weak areas, and available materials only when missing and material.
- Do not produce medical, legal, emergency, weapon, or other high-risk procedural instructions. In those cases, provide no steps and use one question explaining that Daylight cannot safely guide that activity.
- needsInput=true means questions is nonempty and steps is empty. needsInput=false means questions is empty and steps is nonempty.
- safetyNote is empty unless a step has a specific safety constraint.

Return only the structured response.`

  let response
  try {
    response = await provider('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 2600,
        system,
        messages: [{ role: 'user', content: JSON.stringify({ type, title, context, answers }) }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: responseSchema } },
      }),
    })
  } catch { return Response.json({ code: 'provider_unreachable' }, { status: 502 }) }
  if (!response.ok) {
    let providerError = {}
    try { providerError = await response.json() } catch { /* retain status */ }
    const code = response.status === 401 || response.status === 403 ? 'provider_auth'
      : response.status === 402 ? 'provider_balance'
      : response.status === 404 ? 'provider_model'
      : response.status === 429 ? 'provider_rate_limit' : 'provider_request'
    console.error('Guide request failed', response.status, providerError?.error?.type || 'unknown')
    return Response.json({ code }, { status: response.status === 429 ? 429 : 502 })
  }
  let data
  try { data = await response.json() } catch { return Response.json({ code: 'provider_response' }, { status: 502 }) }
  const output = data.content?.find(block => block.type === 'text')?.text
  if (!output) return Response.json({ code: 'provider_response' }, { status: 502 })
  try { return Response.json(JSON.parse(output), { headers: { 'cache-control': 'no-store' } }) }
  catch { return Response.json({ code: 'provider_response' }, { status: 502 }) }
}

export default req => handleGuide(req)
export const config = { path: '/api/guide' }
