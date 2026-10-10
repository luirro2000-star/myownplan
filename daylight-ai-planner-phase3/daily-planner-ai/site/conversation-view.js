export function selectConversationTurns(messages = []) {
  const turns = []
  let awaitingReply = false
  for (const message of messages) {
    if (message.kind === 'activity') continue
    if (message.kind === 'conversation' || message.id === 'hello') {
      turns.push(message)
      awaitingReply = message.role === 'user'
      continue
    }
    // Earlier saves did not identify activity records. Preserve each user turn
    // and its first reply while allowing automatic status entries to move out.
    if (message.role === 'user') {
      turns.push(message)
      awaitingReply = true
    } else if (awaitingReply) {
      turns.push(message)
      awaitingReply = false
    }
  }
  return turns
}
