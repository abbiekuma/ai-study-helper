import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationList } from '../components/ConversationList'
import { ChatUI } from '../components/ChatUI'
import { QuizPanel } from '../components/QuizPanel'
import { getQuizQuestions, getQuizzes, updateQuizSaved } from '../lib/chat.server'
import { useServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/')({ component: HomePage })

type QuizQuestion = Awaited<ReturnType<typeof getQuizQuestions>>
type Quiz = Awaited<ReturnType<typeof getQuizzes>>[number]

const MIN_PANEL_PERCENT = 20
const MAX_PANEL_PERCENT = 80
const DEFAULT_QUIZ_PERCENT = 50

function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion>([])
  const [quizPanelPercent, setQuizPanelPercent] = useState(DEFAULT_QUIZ_PERCENT)
  const [resizing, setResizing] = useState(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const getQuizzesFn = useServerFn(getQuizzes)
  const getQuizQuestionsFn = useServerFn(getQuizQuestions)
  const updateQuizSavedFn = useServerFn(updateQuizSaved)

  // When conversation changes: fetch quizzes and pick first as selected
  useEffect(() => {
    if (selectedConversationId == null) {
      setQuizzes([])
      setSelectedQuizId(null)
      setQuizQuestions([])
      return
    }
    getQuizzesFn({ data: { conversationId: selectedConversationId } })
      .then((list) => {
        setQuizzes(list)
        setSelectedQuizId(list[0]?.id ?? null)
      })
      .catch(() => {
        setQuizzes([])
        setSelectedQuizId(null)
      })
  }, [selectedConversationId, getQuizzesFn])

  // When selected quiz changes: fetch questions for that quiz
  useEffect(() => {
    if (selectedQuizId == null) {
      setQuizQuestions([])
      return
    }
    getQuizQuestionsFn({ data: { quizId: selectedQuizId } })
      .then(setQuizQuestions)
      .catch(() => setQuizQuestions([]))
  }, [selectedQuizId, getQuizQuestionsFn])

  const showQuizPanel =
    selectedConversationId != null && selectedQuizId != null

  const handleCloseQuizPanel = useCallback(() => {
    setSelectedQuizId(null)
  }, [])

  const handleOpenQuiz = useCallback((quizId: number) => {
    setSelectedQuizId(quizId)
  }, [])

  const refetchQuiz = useCallback(() => {
    if (selectedQuizId == null) return
    getQuizQuestionsFn({ data: { quizId: selectedQuizId } }).then(setQuizQuestions)
  }, [selectedQuizId, getQuizQuestionsFn])

  const refetchQuizzes = useCallback(() => {
    if (selectedConversationId == null) return
    getQuizzesFn({ data: { conversationId: selectedConversationId } }).then(
      setQuizzes,
    )
  }, [selectedConversationId, getQuizzesFn])

  /**
   * When a new quiz is generated: optionally set conversation (e.g. new chat),
   * set selected quiz to the new quizId, then refetch quizzes and questions.
   */
  const onQuizGenerated = useCallback(
    (conversationIdWithQuiz?: number, quizId?: number) => {
      const cid = conversationIdWithQuiz ?? selectedConversationId
      if (cid != null) setSelectedConversationId(cid)
      if (quizId != null) setSelectedQuizId(quizId)
      if (cid != null) {
        getQuizzesFn({ data: { conversationId: cid } }).then(setQuizzes)
      }
      if (quizId != null) {
        getQuizQuestionsFn({ data: { quizId } }).then(setQuizQuestions)
      }
    },
    [selectedConversationId, getQuizzesFn, getQuizQuestionsFn],
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
                quizId={selectedQuizId}
                quizzes={quizzes}
                onSelectQuiz={setSelectedQuizId}
                questions={quizQuestions}
                onRefresh={refetchQuiz}
                onClose={handleCloseQuizPanel}
                isSaved={
                  quizzes.find((q) => q.id === selectedQuizId)?.isSaved ?? false
                }
                onToggleSaved={
                  selectedQuizId != null
                    ? async () => {
                        const q = quizzes.find((q) => q.id === selectedQuizId)
                        if (!q) return
                        await updateQuizSavedFn({
                          data: {
                            quizId: selectedQuizId,
                            isSaved: !q.isSaved,
                          },
                        })
                        refetchQuizzes()
                      }
                    : undefined
                }
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
            quizzes={quizzes}
            selectedQuizId={selectedQuizId}
            onOpenQuiz={handleOpenQuiz}
          />
        </main>
      </div>
    </div>
  )
}
