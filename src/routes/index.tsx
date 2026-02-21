import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ConversationList } from '../components/ConversationList'
import { ChatUI } from '../components/ChatUI'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ConversationList
        selectedId={selectedConversationId}
        onSelect={setSelectedConversationId}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        <ChatUI
          conversationId={selectedConversationId}
          onConversationCreated={setSelectedConversationId}
        />
      </main>
    </div>
  )
}
