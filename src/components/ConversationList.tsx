// src/components/ConversationList.tsx
import { useServerFn } from '@tanstack/react-start'
import { deleteConversation, getConversations } from '../lib/chat.server'
import { useCallback, useEffect, useRef, useState } from 'react'

const DELETE_CONFIRM_MESSAGE =
  'Are you sure to delete this chat? If you choose to delete this chat, the quizzes within this chat will also be deleted. You can save the quiz you would like to keep before deleting the chat.'

type Conversation = {
  id: number
  mode: string
  title: string | null
  createdAt: Date
}

type Props = {
  selectedId: number | null
  onSelect: (id: number | null) => void
  /** Called after a conversation was deleted; pass the deleted id so parent can clear selection if needed. */
  onDeleted?: (conversationId: number) => void
}

export function ConversationList({ selectedId, onSelect, onDeleted }: Props) {
  const fetchConversations = useServerFn(getConversations)
  const deleteConversationFn = useServerFn(deleteConversation)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .finally(() => setLoading(false))
  }, [fetchConversations])

  useEffect(() => {
    if (openDropdownId == null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return
      setOpenDropdownId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdownId])

  const handleNewChat = () => {
    onSelect(null)
  }

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, c: Conversation) => {
      e.stopPropagation()
      setOpenDropdownId(null)
      const ok = window.confirm(DELETE_CONFIRM_MESSAGE)
      if (!ok) return
      deleteConversationFn({ data: { conversationId: c.id } })
        .then(() => {
          return fetchConversations().then(setConversations)
        })
        .then(() => {
          onDeleted?.(c.id)
        })
        .catch((err) => {
          console.error('Delete conversation failed:', err)
        })
    },
    [deleteConversationFn, fetchConversations, onDeleted],
  )

  const openDropdown = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setOpenDropdownId((prev) => (prev === id ? null : id))
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
          <li key={c.id} className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === c.id
                  ? 'bg-cyan-100 text-cyan-800'
                  : 'hover:bg-gray-200'
              }`}
            >
              {c.title ?? `Chat ${c.id}`}
            </button>
            <button
              ref={openDropdownId === c.id ? triggerRef : undefined}
              type="button"
              onClick={(e) => openDropdown(e, c.id)}
              className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="More options"
              aria-expanded={openDropdownId === c.id}
            >
              <span aria-hidden>⋯</span>
            </button>
            {openDropdownId === c.id && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={(e) => handleDeleteClick(e, c)}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
