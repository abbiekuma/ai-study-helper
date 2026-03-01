// src/components/ChatUI.tsx

import { useServerFn } from '@tanstack/react-start'
import { getMessages, sendMessage } from '../lib/chat.server'
import type { ChatMode } from '../lib/gemini.server'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = {
  id: number
  role: string
  content: string
  mode?: string | null
  modelUsed?: string | null
  createdAt: Date
}

const MODE_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  'deep-dive': 'Deep-dive',
  quiz: 'Quiz',
}

function modeLabel(mode: string | null | undefined): string {
  if (!mode) return ''
  return MODE_LABELS[mode] ?? mode
}

// Get mode for display: from message.mode, or for old assistant messages parse from modelUsed e.g. "gemini-2.5-flash-lite (beginner)"
function getDisplayMode(m: Message): string | null {
  if (m.mode) return m.mode
  if (m.role === 'assistant' && m.modelUsed) {
    const match = m.modelUsed.match(/\(([^)]+)\)$/)
    if (match) return match[1]
  }
  return null
}

type Props = {
  conversationId: number | null
  onConversationCreated?: (id: number) => void
  /** Called after a quiz was generated; pass conversation id and new quiz id for refetch / new-conversation case. */
  onQuizGenerated?: (conversationIdWithQuiz?: number, quizId?: number) => void
  /** Quizzes for the current chat; when present and non-empty, show Quiz bar to reopen panel. */
  quizzes?: Array<{ id: number; createdAt: Date; isSaved: boolean }>
  /** Currently selected quiz id (for highlighting in bar). */
  selectedQuizId?: number | null
  /** Called when user clicks a quiz in the bar to open the quiz panel. */
  onOpenQuiz?: (quizId: number) => void
}

const MODES: { value: ChatMode; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'deep-dive', label: 'Deep-dive' },
  { value: 'quiz', label: 'Quiz' },
]

export function ChatUI({
  conversationId,
  onConversationCreated,
  onQuizGenerated,
  quizzes = [],
  selectedQuizId = null,
  onOpenQuiz,
}: Props) {
  const sendMessageFn = useServerFn(sendMessage)
  const getMessagesFn = useServerFn(getMessages)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState<ChatMode>('beginner')

  useEffect(() => {
    if (conversationId == null) {
      setMessages([])
      return
    }
    getMessagesFn({ data: { conversationId } })
      .then(setMessages)
      .catch(console.error)
  }, [conversationId, getMessagesFn])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)
    try {
      const result = await sendMessageFn({
        data: {
          conversationId: conversationId ?? undefined,
          userMessage: text,
          mode: selectedMode,
        },
      })
      if (
        result.conversationId != null &&
        onConversationCreated &&
        conversationId == null
      ) {
        onConversationCreated(result.conversationId)
      }
      if (selectedMode === 'quiz') {
        onQuizGenerated?.(
          result.conversationId ?? conversationId ?? undefined,
          result.quizId,
        )
      }
      setMessages((prev) => [
        ...prev,
        {
          id: -1,
          role: 'user',
          content: text,
          mode: selectedMode,
          createdAt: new Date(),
        },
        {
          id: -2,
          role: 'assistant',
          content: result.assistantMessage.content,
          mode: result.assistantMessage.mode,
          createdAt: new Date(),
        },
      ])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversationId != null && quizzes.length > 0 && onOpenQuiz != null && (
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2">
          <span className="mr-2 text-xs font-medium text-gray-500">
            Quizzes:
          </span>
          <div className="flex flex-wrap gap-2">
            {quizzes.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onOpenQuiz(q.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedQuizId === q.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Quiz {i + 1}
                {q.isSaved ? ' ★' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 && conversationId == null && (
          <p className="text-gray-500">
            Choose Beginner / Deep-dive / Quiz, then send a message to start.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-3 rounded-lg p-3 ${
              m.role === 'user' ? 'ml-8 bg-cyan-100' : 'mr-8 bg-gray-100'
            }`}
          >
            <span className="text-xs font-medium text-gray-500">
              {m.role === 'user' ? 'User' : 'Assistant'}
              {modeLabel(getDisplayMode(m)) ? (
                <> · {modeLabel(getDisplayMode(m))}</>
              ) : null}
            </span>
            <div className="mt-1 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="mb-2 flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setSelectedMode(m.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                selectedMode === m.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
