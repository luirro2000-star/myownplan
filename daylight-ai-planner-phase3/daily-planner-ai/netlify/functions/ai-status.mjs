import { getUser, verifyRequestOrigin } from '@netlify/identity'

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export async function handleAIStatus(req, { currentUser = getUser, checkOrigin = verifyRequestOrigin, provider = fetch } = {}) {
  if (req.method !== 'POST') return json({ code: 'method_not_allowed' }, 405)
  if (!(await currentUser())?.id) return json({ code: 'unauthorized', error: 'Sign in to check AI.' }, 401)
  try { checkOrigin(req) } catch { return json({ code: 'invalid_origin' }, 403) }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return json({ code: 'missing_key', error: 'The AI key is missing from Netlify Functions.' }, 503)
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
  let response
  try {
    response = await provider(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
  } catch { return json({ code: 'provider_unreachable', error: 'The AI provider could not be reached.' }, 502) }

  if (response.ok) return json({ connected: true, model })
  const code = response.status === 401 || response.status === 403 ? 'provider_auth'
    : response.status === 402 ? 'provider_balance'
    : response.status === 404 ? 'provider_model'
    : response.status === 429 ? 'provider_rate_limit' : 'provider_request'
  return json({ connected: false, code }, response.status === 429 ? 429 : 502)
}

export default req => handleAIStatus(req)
export const config = { path: '/api/ai-status' }
