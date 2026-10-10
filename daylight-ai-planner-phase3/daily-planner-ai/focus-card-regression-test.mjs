import assert from 'node:assert/strict'
import { selectFocusItem } from './site/focus-card.js'

const items = [
  { id: 'done', title: 'Done', start: '08:00', end: '08:30', completed: true },
  { id: 'earlier', title: 'Earlier', start: '09:00', end: '09:30' },
  { id: 'active', title: 'Active', start: '10:00', end: '11:00' },
  { id: 'skipped', title: 'Skipped', start: '11:00', end: '11:30', skipped: true },
  { id: 'next', title: 'Next', start: '12:00', end: '12:30' },
]

assert.deepEqual(selectFocusItem(items,{nowMinutes:10*60+15,isCurrentDay:true}),{item:items[2],phase:'now'})
assert.deepEqual(selectFocusItem(items,{nowMinutes:11*60+15,isCurrentDay:true}),{item:items[4],phase:'next'})
assert.deepEqual(selectFocusItem(items,{nowMinutes:13*60,isCurrentDay:true}),{item:items[4],phase:'overdue'})
assert.deepEqual(selectFocusItem(items,{nowMinutes:13*60,isCurrentDay:false}),{item:items[1],phase:'next'})
assert.equal(selectFocusItem(items.map(item=>({...item,completed:true})),{nowMinutes:0,isCurrentDay:true}),null)

console.log('Focus card regression tests passed.')
