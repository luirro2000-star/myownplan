import assert from 'node:assert/strict'
import { selectConversationTurns } from './site/conversation-view.js'

const messages = [
  { id: 'hello', role: 'assistant', text: 'Hello' },
  { id: 'old-action', role: 'assistant', text: 'Moved two tasks' },
  { id: 'question', role: 'user', text: 'What should I do?' },
  { id: 'answer', role: 'assistant', text: 'Start with homework.' },
  { id: 'old-action-2', role: 'assistant', text: 'Replanned Tuesday' },
  { id: 'activity', kind: 'activity', role: 'assistant', text: 'Saved goal' },
  { id: 'new-question', kind: 'conversation', role: 'user', text: 'I feel tired.' },
  { id: 'new-answer', kind: 'conversation', role: 'assistant', text: 'Use Minimum mode.' },
]

assert.deepEqual(
  selectConversationTurns(messages).map(message => message.id),
  ['hello', 'question', 'answer', 'new-question', 'new-answer'],
  'the assistant should show conversations while excluding automatic activity records',
)
assert.deepEqual(selectConversationTurns([]), [], 'an empty history stays empty')

console.log('Conversation view regression tests passed.')
