// [4.1] Quiz panel (middle column). [4.2] Receives questions from parent.
// [5] Render questions + options, submit via 3.2, show correct/incorrect and score.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useServerFn } from '@tanstack/react-start'
import { submitQuizAnswer } from '../lib/chat.server'
import { ChevronDown, X } from 'lucide-react'

type QuizQuestion = {
  id: number
  quizId: number
  title: string
  options: string
  correctAnswer: string
  questionOrder: number
  status: string
  userAnswer: string | null
  score: number | null
  createdAt: Date
}

type Quiz = {
  id: number
  conversationId: number | null
  createdAt: Date
  isSaved: boolean
}

type Props = {
  quizId: number | null
  quizzes: Quiz[]
  conversationTitle?: string | null
  onSelectQuiz?: (quizId: number) => void
  questions: QuizQuestion[]
  onRefresh?: () => void
  isSaved?: boolean
  onToggleSaved?: () => void
  /** When provided, show a close button to hide the quiz panel (e.g. on Chat page). */
  onClose?: () => void
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

function parseOptions(optionsJson: string): Record<string, string> {
  try {
    const o = JSON.parse(optionsJson)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function QuizPicker({
  quizId,
  quizzes,
  onSelectQuiz,
}: {
  quizId: number | null
  quizzes: Quiz[]
  onSelectQuiz?: (quizId: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const selectedIndex = quizzes.findIndex((q) => q.id === quizId)
  const selectedQuiz = selectedIndex >= 0 ? quizzes[selectedIndex] : null

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const label =
    selectedQuiz != null
      ? `Quiz ${selectedIndex + 1}${selectedQuiz.isSaved ? ' ★' : ''}`
      : 'Select quiz'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors hover:bg-secondary"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open &&
        menuStyle &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label="Select quiz"
            className="fixed z-[100] max-h-48 overflow-y-auto rounded-md border border-border bg-card py-1.5 shadow-lg"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              minWidth: menuStyle.minWidth,
            }}
          >
            {quizzes.map((qz, index) => {
              const isSelected = qz.id === quizId
              return (
                <li key={qz.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuiz?.(qz.id)
                      setOpen(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-primary-muted/60 ${
                      isSelected
                        ? 'bg-primary-muted font-medium text-primary-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    Quiz {index + 1}
                    {qz.isSaved ? ' ★' : ''}
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}

export function QuizPanel({
  quizId,
  quizzes,
  conversationTitle,
  onSelectQuiz,
  questions,
  onRefresh,
  isSaved = false,
  onToggleSaved,
  onClose,
}: Props) {
  const submitAnswerFn = useServerFn(submitQuizAnswer)
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const totalScore = questions.reduce((sum, q) => sum + (q.score ?? 0), 0)
  const answeredCount = questions.filter((q) => q.status !== 'pending').length

  const handleSelect = async (q: QuizQuestion, key: string) => {
    if (q.status !== 'pending' || submittingId != null) return
    setSubmittingId(q.id)
    try {
      await submitAnswerFn({ data: { questionId: q.id, userAnswer: key } })
      onRefresh?.()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-quiz">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Quiz
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {onToggleSaved != null && (
              <button
                type="button"
                onClick={onToggleSaved}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={isSaved ? 'Unsave quiz' : 'Save quiz'}
              >
                {isSaved ? '★ Saved' : '☆ Save'}
              </button>
            )}
            {onClose != null && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close quiz panel"
                title="Close quiz panel"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        {(conversationTitle || quizzes.length > 1) && (
          <div className="flex items-center justify-between gap-4">
            {conversationTitle ? (
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {conversationTitle}
              </p>
            ) : (
              <span />
            )}
            {quizzes.length > 1 && (
              <QuizPicker
                quizId={quizId}
                quizzes={quizzes}
                onSelectQuiz={onSelectQuiz}
              />
            )}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {quizId == null ? (
          <p className="text-sm text-stone-500">Select a conversation.</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-stone-500">
            Questions will appear here when you request a quiz in this
            conversation.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Score: {totalScore}/{questions.length} · {answeredCount} answered
            </p>
            {questions.map((q) => {
              const options = parseOptions(q.options)
              const answered = q.status !== 'pending'
              const isSubmitting = submittingId === q.id
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <p className="mb-3 text-sm font-medium leading-relaxed text-foreground">
                    {q.questionOrder}. {q.title}
                  </p>
                  <div className="space-y-2">
                    {OPTION_KEYS.map((key) => {
                      const label = options[key] ?? `Option ${key}`
                      const isChosen = q.userAnswer === key
                      const isCorrect = q.correctAnswer === key
                      const showCorrect = answered && isCorrect
                      const showWrong = answered && isChosen && !isCorrect
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={answered || isSubmitting}
                          onClick={() => handleSelect(q, key)}
                          className={`w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                            answered
                              ? 'cursor-default border-border bg-card'
                              : 'border-border hover:bg-muted/60'
                          } ${showCorrect ? 'border-quiz-correct bg-quiz-correct-bg' : ''} ${
                            showWrong ? 'border-quiz-wrong bg-quiz-wrong-bg' : ''
                          } ${isChosen && !answered ? 'ring-1 ring-ring' : ''}`}
                        >
                          <span className="font-medium">{key}.</span> {label}
                          {showCorrect && (
                            <span className="ml-2 text-xs text-quiz-correct">
                              ✓ Correct
                            </span>
                          )}
                          {showWrong && (
                            <span className="ml-2 text-xs text-quiz-wrong">
                              ✗ Wrong (correct: {q.correctAnswer})
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
