import { useState } from 'react'
import { createChatService } from './chat/createChatService'
import { DebugPanel } from './components/DebugPanel/DebugPanel'
import { useAppHeight } from './hooks/useAppHeight'
import { useChat } from './hooks/useChat'
import { ChatScreen } from './screens/ChatScreen/ChatScreen'
import { JoinScreen } from './screens/JoinScreen/JoinScreen'

export default function App() {
  const [service] = useState(createChatService)
  const chat = useChat(service)
  useAppHeight()

  const showDebug = service.debug !== undefined && new URLSearchParams(window.location.search).has('debug')

  return (
    <>
      {chat.phase === 'chat' ? <ChatScreen chat={chat} /> : <JoinScreen chat={chat} />}
      {showDebug && service.debug && <DebugPanel controls={service.debug} />}
    </>
  )
}
