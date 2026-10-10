import assert from 'node:assert/strict'
import { normalizeGuideResponse, createSavedGuide, currentGuideStep } from './site/guided-mode.js'

const questions = normalizeGuideResponse({needsInput:true,questions:[{id:'ingredients',label:'What ingredients do you have?',placeholder:'List them'}],title:'',summary:'',materials:[],steps:[]})
assert.equal(questions.needsInput,true)
assert.equal(questions.questions.length,1)

const generated = createSavedGuide({needsInput:false,questions:[],title:'Prepare for interview',summary:'A focused rehearsal.',materials:['Job description'],steps:[
  {title:'Read the role',instruction:'Highlight the three most important responsibilities.',durationMinutes:10,safetyNote:''},
  {title:'Practice one story',instruction:'Use the STAR structure.',durationMinutes:15,safetyNote:''},
]},{id:'guide-1',sourceItemId:'interview',type:'interview',now:'2026-10-10T12:00:00Z'})
assert.equal(generated.steps.length,2)
assert.equal(currentGuideStep(generated).step.title,'Read the role')
generated.steps[0].completed=true
assert.equal(currentGuideStep(generated).step.title,'Practice one story')
generated.steps[1].completed=true
assert.equal(currentGuideStep(generated).finished,true)
assert.equal(normalizeGuideResponse({needsInput:false,questions:[],steps:[]}),null)

console.log('Guided mode regression tests passed.')
