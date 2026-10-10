import assert from 'node:assert/strict'
import { handleAIStatus } from './netlify/functions/ai-status.mjs'

const previousKey=process.env.ANTHROPIC_API_KEY
const req=()=>new Request('https://example.test/api/ai-status',{method:'POST'})
const status=(options={})=>handleAIStatus(req(),{currentUser:async()=>({id:'test-user'}),checkOrigin:()=>{},...options})

try {
  assert.equal((await handleAIStatus(req(),{currentUser:async()=>null})).status,401)
  assert.equal((await status({checkOrigin:()=>{throw Error('wrong origin')}})).status,403)
  delete process.env.ANTHROPIC_API_KEY
  assert.equal((await (await status()).json()).code,'missing_key')

  process.env.ANTHROPIC_API_KEY='test-only-key'
  let providerUrl,providerOptions
  const ok=await status({provider:async(url,options)=>{providerUrl=url;providerOptions=options;return Response.json({id:'claude-sonnet-5-5'})}})
  assert.equal((await ok.json()).connected,true)
  assert.match(providerUrl,/\/v1\/models\/claude-sonnet-5-5$/)
  assert.equal(providerOptions.headers['x-api-key'],'test-only-key')
  assert.equal(providerOptions.body,undefined,'the check must send no planner data')

  const badModel=await status({provider:async()=>Response.json({},{status:404})})
  assert.equal((await badModel.json()).code,'provider_model')
  console.log('AI_STATUS_REGRESSION_TEST_PASS')
} finally {
  if(previousKey===undefined)delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY=previousKey
}
