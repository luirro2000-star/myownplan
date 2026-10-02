import assert from 'node:assert/strict'
import { normalizeIntakeAnalysis, applyIntakeAnalysis, localIntakeFallback, createIntakeCapture, finishIntakeCapture } from './site/intake.js'

const normalized = normalizeIntakeAnalysis({
  summary: 'test',
  understood: [
    { type:'event', title:'Motion 3D', sourceText:'7:15 - Motion 3d', day:'Monday', start:'', end:'', recurrence:'once', priority:2, durationMinutes:0, details:'', target:0, unit:'', deadlineDay:'', preferredStart:'', preferredEnd:'', splittable:false, minBlockMinutes:0, confidence:.55, needsConfirmation:true, question:'AM or PM?' },
    { type:'routine', title:'Make bed', sourceText:'Make my bed everyday', day:'', start:'', end:'', recurrence:'daily', priority:2, durationMinutes:5, details:'', target:0, unit:'', deadlineDay:'', preferredStart:'', preferredEnd:'', splittable:false, minBlockMinutes:0, confidence:.91, needsConfirmation:false, question:'' },
  ],
  questions:['AM or PM?'],
})
assert.equal(normalized.items[0].accepted, false, 'ambiguous items should start unchecked')
assert.equal(normalized.items[1].accepted, true, 'high-confidence items should start selected')

const base = { items:[], rules:[], goals:[], metrics:[], openLoops:[], inbox:[] }
let n=0
const applied = applyIntakeAnalysis(base, normalized, { idFactory:()=>`t${++n}` })
assert.equal(applied.state.items.length, 5, 'daily routine should materialize across weekdays')
assert(applied.state.items.every(i => i.kind === 'routine'), 'daily entries should stay routines')
assert(applied.state.items.every(i => i.flexible === true), 'untimed routines should remain schedulable')
assert.deepEqual(applied.state.items.map(i=>i.deadlineDay), ['Monday','Tuesday','Wednesday','Thursday','Friday'], 'recurring routines should stay on their intended day')

const capture=createIntakeCapture({id:'capture-1',rawText:'A class and daily routine',analysis:normalized,source:'anthropic',createdAt:'2026-10-02T00:00:00Z'})
assert.equal(capture.review.items.length,2,'the full review should be stored with its capture')
const partial=finishIntakeCapture(capture,['review-2'])
assert.equal(partial.status,'needs_review','unapplied questions should stay available')
assert.deepEqual(partial.review.items.map(item=>item.reviewId),['review-1'])
assert.deepEqual(partial.review.questions,['AM or PM?'])
assert.equal(partial.appliedCount,1)
assert.equal(JSON.parse(JSON.stringify(partial)).review.items[0].question,'AM or PM?','an unresolved review should survive storage serialization')
const completed=finishIntakeCapture(partial,['review-1'])
assert.equal(completed.status,'applied')
assert.equal(completed.review,null)
assert.equal(completed.appliedCount,2)
const duplicateIds=normalizeIntakeAnalysis({understood:[
  {reviewId:'same',type:'task',title:'One'},
  {reviewId:'same',type:'task',title:'Two'},
]})
assert.notEqual(duplicateIds.items[0].reviewId,duplicateIds.items[1].reviewId,'review IDs must be unique for partial application')

const allTypes = normalizeIntakeAnalysis({understood:[
  {type:'rule',title:'Arrive early',details:'Arrive 15 minutes early',confidence:.9},
  {type:'goal',title:'Gym',target:3,unit:'sessions',recurrence:'weekly',confidence:.9},
  {type:'metric',title:'School points',target:4000,unit:'points',recurrence:'daily',confidence:.9},
  {type:'open_loop',title:'Make new friends',details:'Social intention',confidence:.9},
]})
const result = applyIntakeAnalysis(base, allTypes, { idFactory:()=>`x${++n}` }).state
assert.equal(result.rules.length,1)
assert.equal(result.goals.length,1)
assert.equal(result.metrics.length,1)
assert.equal(result.openLoops.length,1)

const fallback = localIntakeFallback(`Monday\n8:30 - Matt\nMake my bed everyday.\nGet to at least 4000 points before leaving.`)
assert(fallback.items.some(i=>i.type==='event' && i.day==='Monday'))
assert(fallback.items.some(i=>i.type==='routine'))
assert(fallback.items.some(i=>i.type==='metric' && i.target===4000))

console.log('Phase 3 intake regression tests passed.')
