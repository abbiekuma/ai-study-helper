// src/components/ConversationList.tsx
import { useServerFn } from '@tanstack/react-start'
import { getConversations } from '../lib/chat.server'
import { useEffect, useState } from 'react'

type Conversation = {
  id: number
  mode: string
  title: string | null
  createdAt: Date
}

type Props = {
  selectedId: number | null
  onSelect: (id: number | null) => void
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const fetchConversations = useServerFn(getConversations)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .finally(() => setLoading(false))
  }, [fetchConversations])

  const handleNewChat = () => {
    onSelect(null)
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <aside className="w-64 border-r border-gray-200 bg-gray-50 p-4">
      <button
        type="button"
        onClick={handleNewChat}
        className="mb-4 w-full rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
      >
        New chat
      </button>
      <ul className="space-y-1">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === c.id
                  ? 'bg-cyan-100 text-cyan-800'
                  : 'hover:bg-gray-200'
              }`}
            >
              {c.title ?? `Chat ${c.id}`}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
