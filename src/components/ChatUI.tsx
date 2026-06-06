// src/components/ChatUI.tsx

import { useServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { getMessages, sendMessage } from '../lib/chat.server'
import type { ChatMode } from '../lib/gemini.server'
import { useGeminiKey } from '../contexts/GeminiKeyContext'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = {
  id: number
  role: string
  content: string
  mode?: string | null
  modelUsed?: string | null
  createdAt: Date
  isLoading?: boolean
}

function AssistantLoadingBubble() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
    </div>
  )
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
  const { hasKey, getKeyForRequest } = useGeminiKey()
  const canSend = hasKey || import.meta.env.DEV
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState<ChatMode>('beginner')
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  const prevConversationIdRef = useRef<number | null>(conversationId)

  useEffect(() => {
    const prev = prevConversationIdRef.current
    prevConversationIdRef.current = conversationId

    if (conversationId == null) {
      if (prev != null) setMessages([])
      return
    }
    getMessagesFn({ data: { conversationId } })
      .then(setMessages)
      .catch(console.error)
  }, [conversationId, getMessagesFn])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading || !canSend) return

    const sendForConversationId = conversationId
    const pendingUserId = -Date.now()
    const pendingAssistantId = pendingUserId - 1

    setInput('')
    setLoading(true)
    setMessages((prev) => [
      ...prev,
      {
        id: pendingUserId,
        role: 'user',
        content: text,
        mode: selectedMode,
        createdAt: new Date(),
      },
      {
        id: pendingAssistantId,
        role: 'assistant',
        content: '',
        mode: selectedMode,
        createdAt: new Date(),
        isLoading: true,
      },
    ])

    try {
      const result = await sendMessageFn({
        data: {
          conversationId: conversationId ?? undefined,
          userMessage: text,
          mode: selectedMode,
          apiKey: getKeyForRequest(),
        },
      })

      const stillSameConversation =
        sendForConversationId === conversationIdRef.current ||
        (sendForConversationId == null &&
          result.conversationId === conversationIdRef.current)

      if (!stillSameConversation) return

      if (
        result.conversationId != null &&
        onConversationCreated &&
        sendForConversationId == null
      ) {
        onConversationCreated(result.conversationId)
      }
      if (selectedMode === 'quiz') {
        onQuizGenerated?.(
          result.conversationId ?? sendForConversationId ?? undefined,
          result.quizId,
        )
      }

      if (sendForConversationId != null) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingAssistantId
              ? {
                  id: pendingAssistantId,
                  role: 'assistant',
                  content: result.assistantMessage.content,
                  mode: result.assistantMessage.mode,
                  createdAt: new Date(),
                }
              : m,
          ),
        )
      }
    } catch (e) {
      console.error(e)
      setMessages((prev) => prev.filter((m) => m.id !== pendingAssistantId))
      setInput(text)
      window.alert(
        e instanceof Error ? e.message : 'Failed to send message. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hasKey ? (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {import.meta.env.DEV ? (
            <>
              Add your Gemini API key in{' '}
              <Link to="/settings" className="font-medium underline hover:text-amber-950">
                Settings
              </Link>
              , or rely on <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> in{' '}
              <code className="rounded bg-amber-100 px-1">.env.local</code> for local dev.
            </>
          ) : (
            <>
              Add your Gemini API key in{' '}
              <Link to="/settings" className="font-medium underline hover:text-amber-950">
                Settings
              </Link>{' '}
              to start chatting. Keys stay in this browser session only.
            </>
          )}
        </div>
      ) : null}
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
              {m.isLoading ? (
                <AssistantLoadingBubble />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              )}
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
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            placeholder="Type a message..."
            disabled={loading || !canSend}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !canSend}
            className="inline-flex min-w-[4.5rem] items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>Sending</span>
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
