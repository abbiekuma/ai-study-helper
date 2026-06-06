// src/components/ChatUI.tsx

import { useServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { getMessages, sendMessage } from '../lib/chat.server'
import type { ChatMode } from '../lib/gemini.server'
import type { QuizAction } from '../lib/quiz.service'
import { useGeminiKey } from '../contexts/GeminiKeyContext'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HomeIntro } from './HomeIntro'

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
      <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" />
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

function getLastMessageMode(msgs: Message[]): string | null {
  if (msgs.length === 0) return null
  return getDisplayMode(msgs[msgs.length - 1])
}

function resolveQuizAction(
  messages: Message[],
  hasQuiz: boolean,
  selected: QuizAction | null,
): QuizAction {
  if (!hasQuiz || getLastMessageMode(messages) !== 'quiz') {
    return 'generate'
  }
  return selected ?? 'follow-up'
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
  const { hasKey, hasServerEnvKey, isConfigured, getKeyForRequest } = useGeminiKey()
  const canSend = isConfigured
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState<ChatMode>('beginner')
  const [quizAction, setQuizAction] = useState<QuizAction | null>(null)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  const prevConversationIdRef = useRef<number | null>(conversationId)
  const hasQuiz = quizzes.length > 0

  useEffect(() => {
    if (selectedMode !== 'quiz') {
      setQuizAction(null)
      return
    }
    setQuizAction((prev) => resolveQuizAction(messages, hasQuiz, prev))
  }, [selectedMode, hasQuiz, conversationId, messages])

  const followUpQuizId =
    selectedQuizId ?? (hasQuiz ? quizzes[quizzes.length - 1]?.id : undefined)

  const effectiveQuizAction: QuizAction | undefined =
    selectedMode === 'quiz'
      ? resolveQuizAction(messages, hasQuiz, quizAction)
      : undefined

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
    const sendQuizAction =
      selectedMode === 'quiz'
        ? resolveQuizAction(messages, hasQuiz, quizAction)
        : undefined
    const sendFollowUpQuizId =
      sendQuizAction === 'follow-up' ? followUpQuizId : undefined
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
          quizAction: sendQuizAction,
          activeQuizId: sendFollowUpQuizId,
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
      if (selectedMode === 'quiz' && result.quizId != null) {
        onQuizGenerated?.(
          result.conversationId ?? sendForConversationId ?? undefined,
          result.quizId,
        )
        setQuizAction('follow-up')
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
    <div className="flex min-h-0 flex-1 flex-col bg-chat">
      {!isConfigured ? (
        <div className="flex-shrink-0 border-b border-primary-muted bg-primary-muted/50 px-4 py-3 text-sm text-primary-muted-foreground">
          Add your Gemini API key in{' '}
          <Link to="/settings" className="font-medium underline hover:text-primary-muted-foreground">
            Settings
          </Link>{' '}
          to start chatting. Keys stay in this browser session only.
        </div>
      ) : null}
      {conversationId != null && quizzes.length > 0 && onOpenQuiz != null && (
        <div className="flex-shrink-0 border-b border-border bg-chat px-3 py-2">
          <span className="mr-2 text-xs font-medium text-stone-500">
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
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
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
        {messages.length === 0 && conversationId == null && <HomeIntro />}
        {messages.length === 0 &&
          conversationId != null &&
          selectedMode === 'quiz' && (
            <p className="text-stone-500">
              After learning in Beginner or Deep-dive, switch to Quiz and send
              any message—the quiz panel will open with clickable questions.
            </p>
          )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-3 rounded-lg p-3 ${
              m.role === 'user'
                ? 'ml-8 bg-primary-muted text-foreground'
                : 'mr-8 border border-border/60 bg-card'
            }`}
          >
            <span className="text-xs font-medium text-stone-500">
              {m.role === 'user' ? 'User' : 'Assistant'}
              {modeLabel(getDisplayMode(m)) ? (
                <> · {modeLabel(getDisplayMode(m))}</>
              ) : null}
            </span>
            <div
              className={`mt-1 max-w-none prose prose-sm prose-code:text-foreground prose-pre:text-foreground prose-pre-code:text-foreground dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 ${
                m.role === 'assistant' ? 'assistant-prose' : ''
              }`}
            >
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
      <div className="flex-shrink-0 border-t border-border bg-chat p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {MODES.map((m) => {
            if (m.value === 'quiz') {
              const isQuizSelected = selectedMode === 'quiz'
              const showSubActions = isQuizSelected && hasQuiz

              return (
                <div
                  key={m.value}
                  className={`flex overflow-hidden rounded-lg text-sm font-medium ${
                    isQuizSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  {showSubActions ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMode('quiz')
                          setQuizAction('generate')
                        }}
                        className={`border-r border-primary/30 px-3 py-1.5 transition-colors ${
                          effectiveQuizAction === 'generate'
                            ? 'bg-primary-active'
                            : 'hover:bg-primary-hover'
                        }`}
                      >
                        New Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMode('quiz')
                          setQuizAction('follow-up')
                        }}
                        className={`px-3 py-1.5 transition-colors ${
                          effectiveQuizAction === 'follow-up'
                            ? 'bg-primary-active'
                            : 'hover:bg-primary-hover'
                        }`}
                      >
                        Follow-up
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedMode('quiz')}
                      className={`px-3 py-1.5 ${
                        isQuizSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      Quiz
                    </button>
                  )}
                </div>
              )
            }

            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelectedMode(m.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  selectedMode === m.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            placeholder={
              selectedMode === 'quiz'
                ? effectiveQuizAction === 'generate'
                  ? hasQuiz
                    ? 'Send to generate a new quiz…'
                    : 'Send any message to generate a quiz…'
                  : 'Ask about a question or concept…'
                : 'Type a message...'
            }
            disabled={loading || !canSend}
            className="flex-1 rounded-lg border border-border bg-input px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !canSend}
            className="inline-flex min-w-[4.5rem] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
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
