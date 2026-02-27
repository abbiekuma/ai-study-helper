import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationList } from '../components/ConversationList'
import { ChatUI } from '../components/ChatUI'
import { QuizPanel } from '../components/QuizPanel'
import { getQuizQuestions } from '../lib/chat.server'
import { useServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/')({ component: HomePage })

type QuizQuestion = Awaited<ReturnType<typeof getQuizQuestions>>

const MIN_PANEL_PERCENT = 20
const MAX_PANEL_PERCENT = 80
const DEFAULT_QUIZ_PERCENT = 50

function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion>([])
  const [quizPanelPercent, setQuizPanelPercent] = useState(DEFAULT_QUIZ_PERCENT)
  const [resizing, setResizing] = useState(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const getQuizQuestionsFn = useServerFn(getQuizQuestions)

  useEffect(() => {
    if (selectedConversationId == null) {
      setQuizQuestions([])
      return
    }
    getQuizQuestionsFn({ data: { conversationId: selectedConversationId } })
      .then(setQuizQuestions)
      .catch(() => setQuizQuestions([]))
  }, [selectedConversationId, getQuizQuestionsFn])

  const showQuizPanel =
    selectedConversationId != null && quizQuestions.length > 0

  const refetchQuiz = useCallback(
    (conversationId: number) => {
      getQuizQuestionsFn({ data: { conversationId } }).then(setQuizQuestions)
    },
    [getQuizQuestionsFn],
  )

  /**
   * 先看左边：conversationIdWithQuiz 有值吗？（只要它不是 null 或 undefined）
   * 如果有：就把它的值给 id，右边的 selectedConversationId 直接被忽略。
   * 如果左边没值（是 null 或 undefined）：那就别无选择，只能把右边的 selectedConversationId 给 id。
   */
  const onQuizGenerated = useCallback(
    (conversationIdWithQuiz?: number) => {
      const id = conversationIdWithQuiz ?? selectedConversationId
      if (id == null) return
      setSelectedConversationId(id)
      refetchQuiz(id)
    },
    [selectedConversationId, refetchQuiz],
  )

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => {
      const el = contentAreaRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.round((x / rect.width) * 100)
      const clamped = Math.min(
        MAX_PANEL_PERCENT,
        Math.max(MIN_PANEL_PERCENT, pct),
      )
      setQuizPanelPercent(clamped)
    }
    const onUp = () => setResizing(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ConversationList
        selectedId={selectedConversationId}
        onSelect={setSelectedConversationId}
      />
      <div ref={contentAreaRef} className="flex min-w-0 flex-1 flex-row">
        {showQuizPanel ? (
          <>
            <div
              className="flex min-h-0 shrink-0 flex-col border-l border-gray-200 bg-gray-50 overflow-auto"
              style={{
                flex: `0 0 ${quizPanelPercent}%`,
                minWidth: 200,
                maxWidth: '80%',
              }}
            >
              <QuizPanel
                conversationId={selectedConversationId}
                questions={quizQuestions}
                onRefresh={() => {
                  if (selectedConversationId != null)
                    refetchQuiz(selectedConversationId)
                }}
              />
            </div>
            <div
              role="separator"
              aria-valuenow={quizPanelPercent}
              aria-valuemin={MIN_PANEL_PERCENT}
              aria-valuemax={MAX_PANEL_PERCENT}
              tabIndex={0}
              onMouseDown={() => setResizing(true)}
              className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-cyan-400 transition-colors"
              style={{ minWidth: 4 }}
            />
          </>
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatUI
            conversationId={selectedConversationId}
            onConversationCreated={setSelectedConversationId}
            onQuizGenerated={onQuizGenerated}
          />
        </main>
      </div>
    </div>
  )
}
