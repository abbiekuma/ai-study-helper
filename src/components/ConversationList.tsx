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
  onConversationsChange?: (conversations: Conversation[]) => void
}

export function ConversationList({ selectedId, onSelect, onDeleted, onConversationsChange }: Props) {
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
    onConversationsChange?.(conversations)
  }, [conversations, onConversationsChange])

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
          const msg = err?.message ?? String(err)
          window.alert(`Delete failed: ${msg}`)
        })
    },
    [deleteConversationFn, fetchConversations, onDeleted],
  )

  const openDropdown = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setOpenDropdownId((prev) => (prev === id ? null : id))
  }

  if (loading) return <div className="p-4 text-stone-500">Loading...</div>

  return (
    <aside className="w-64 border-r border-border bg-background p-4">
      <button
        type="button"
        onClick={handleNewChat}
        className="mb-4 w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
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
                  ? 'bg-primary-muted text-primary-muted-foreground'
                  : 'hover:bg-muted/80'
              }`}
            >
              {c.title ?? `Chat ${c.id}`}
            </button>
            <button
              ref={openDropdownId === c.id ? triggerRef : undefined}
              type="button"
              onClick={(e) => openDropdown(e, c.id)}
              className="shrink-0 rounded p-1.5 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
              aria-label="More options"
              aria-expanded={openDropdownId === c.id}
            >
              <span aria-hidden>⋯</span>
            </button>
            {openDropdownId === c.id && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-stone-200 bg-card py-1 shadow-lg"
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-primary-muted-foreground hover:bg-primary-muted/50"
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
