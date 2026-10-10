import assert from 'node:assert/strict'
import { handleGuide } from './netlify/functions/guide.mjs'

const priorKey = process.env.ANTHROPIC_API_KEY
const request = body => new Request('https://example.test/api/guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const guide = (req,options={}) => handleGuide(req,{currentUser:async()=>({id:'user'}),checkOrigin:()=>{},...options})

try {
  assert.equal((await handleGuide(request({title:'Dinner'}),{currentUser:async()=>null})).status,401)
  assert.equal((await guide(request({title:'Dinner'}),{checkOrigin:()=>{throw Error('origin')}})).status,403)
  delete process.env.ANTHROPIC_API_KEY
  assert.equal((await guide(request({title:'Dinner'}))).status,503)
  process.env.ANTHROPIC_API_KEY='test-key'
  assert.equal((await guide(request({title:''}))).status,400)
  assert.equal((await guide(request({title:'Dinner',context:'x'.repeat(5001)}))).status,400)

  let sent
  const provider=async (_url,options)=>{
    sent=JSON.parse(options.body)
    return Response.json({content:[{type:'text',text:JSON.stringify({needsInput:false,questions:[],title:'Make dinner',summary:'Use what is available.',materials:['Pan'],steps:[{title:'Prepare',instruction:'Set out the ingredients.',durationMinutes:5,safetyNote:''}]})}]})
  }
  const response=await guide(request({title:'Make dinner',type:'cooking',context:'For two people',answers:{ingredients:'eggs'}}),{provider})
  assert.equal(response.status,200)
  assert.equal((await response.json()).steps.length,1)
  assert.match(sent.system,/Ask at most four short questions/)
  assert.deepEqual(JSON.parse(sent.messages[0].content),{type:'cooking',title:'Make dinner',context:'For two people',answers:{ingredients:'eggs'}})
  console.log('Guide API regression tests passed.')
} finally {
  if(priorKey===undefined)delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY=priorKey
}
