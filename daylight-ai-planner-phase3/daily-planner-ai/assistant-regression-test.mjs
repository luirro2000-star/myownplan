import assert from 'node:assert/strict'
import { handleAssistant } from './netlify/functions/assistant.mjs'
import { handleIntake } from './netlify/functions/intake.mjs'

const previousKey=process.env.ANTHROPIC_API_KEY
const previousFetch=globalThis.fetch
const assistant=(req,options={})=>handleAssistant(req,{currentUser:async()=>({id:'test-user'}),checkOrigin:()=>{},...options})
const intake=(req,options={})=>handleIntake(req,{currentUser:async()=>({id:'test-user'}),checkOrigin:()=>{},...options})
const request=body=>new Request('https://example.test/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const hasUnsupportedNumberConstraint=schema=>schema&&typeof schema==='object'&&(Object.hasOwn(schema,'minimum')||Object.hasOwn(schema,'maximum')||Object.values(schema).some(hasUnsupportedNumberConstraint))

try {
  const unauthorized=await handleAssistant(request({message:'hello'}),{currentUser:async()=>null})
  assert.equal(unauthorized.status,401)
  assert.equal((await assistant(request({message:'hello'}),{checkOrigin:()=>{throw Error('wrong origin')}})).status,403)
  assert.equal((await intake(request({text:'hello'}),{checkOrigin:()=>{throw Error('wrong origin')}})).status,403)
  delete process.env.ANTHROPIC_API_KEY
  const missing=await assistant(request({message:'hello'}))
  assert.equal(missing.status,503)
  assert.equal((await missing.json()).code,'missing_key')

  process.env.ANTHROPIC_API_KEY='test-only-key'
  assert.equal((await assistant(request({message:'x'.repeat(4001)}))).status,413)
  assert.equal((await intake(request({text:'x'.repeat(30001)}))).status,413)
  assert.equal((await assistant(request({message:'hello',state:{padding:'x'.repeat(1_000_000)}}))).status,413)
  assert.equal((await intake(request({text:'hello',state:{padding:'x'.repeat(1_000_000)}}))).status,413)
  let sent
  globalThis.fetch=async (_url,options)=>{
    sent=JSON.parse(options.body)
    return Response.json({content:[{type:'text',text:JSON.stringify({reply:'Sure, here is a plan.',proposals:[],questions:[]})}]})
  }
  const ok=await assistant(request({message:'What about tomorrow?',history:[{role:'assistant',text:'Initial greeting'},{role:'user',text:'Help me plan'},{role:'assistant',text:'Sure'}],state:{items:[]},selectedDay:'Thursday',todayDay:'Wednesday',now:'2026-10-01T14:00:00Z'}))
  assert.equal(ok.status,200)
  assert.equal((await ok.json()).reply,'Sure, here is a plan.')
  assert.deepEqual(sent.messages,[{role:'user',content:'Help me plan'},{role:'assistant',content:'Sure'},{role:'user',content:'What about tomorrow?'}])
  assert.match(sent.system,/Selected day: Thursday\nCurrent local weekday: Wednesday/)
  assert.match(sent.system,/Never describe a selected day's blocks as underway or over when it is not the current weekday/)
  assert.equal(hasUnsupportedNumberConstraint(sent.output_config.format.schema),false)

  await intake(request({text:'I need to finish a project tomorrow.',state:{}}))
  assert.equal(hasUnsupportedNumberConstraint(sent.output_config.format.schema),false)

  globalThis.fetch=async()=>Response.json({error:{type:'authentication_error'}},{status:401})
  const badKey=await assistant(request({message:'hello',state:{items:[]}}))
  assert.equal(badKey.status,502)
  assert.equal((await badKey.json()).code,'provider_auth')

  globalThis.fetch=async()=>Response.json({error:{type:'rate_limit_error'}},{status:429})
  const limited=await assistant(request({message:'hello',state:{items:[]}}))
  assert.equal(limited.status,429)
  assert.equal((await limited.json()).code,'provider_rate_limit')
  console.log('ASSISTANT_REGRESSION_TEST_PASS')
} finally {
  if(previousKey===undefined)delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY=previousKey
  globalThis.fetch=previousFetch
}
