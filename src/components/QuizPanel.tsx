// [4.1] Quiz panel (middle column). [4.2] Receives questions from parent.
// [5] Render questions + options, submit via 3.2, show correct/incorrect and score.
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { submitQuizAnswer } from '../lib/chat.server'
import { X } from 'lucide-react'

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

export function QuizPanel({
  quizId,
  quizzes,
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
    <aside className="flex min-w-0 flex-1 flex-col border-l border-gray-200 bg-gray-50 overflow-hidden">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 flex items-center justify-between gap-2">
        <span>Quiz</span>
        {quizzes.length > 1 && (
          <select
            value={quizId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (!Number.isNaN(id)) onSelectQuiz?.(id)
            }}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {quizzes.map((qz) => (
              <option key={qz.id} value={qz.id}>
                Quiz {quizzes.indexOf(qz) + 1}
                {qz.isSaved ? ' ★' : ''}
              </option>
            ))}
          </select>
        )}
        {onToggleSaved != null && (
            <button
              type="button"
              onClick={onToggleSaved}
              className="rounded px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50"
              title={isSaved ? 'Unsave quiz' : 'Save quiz'}
            >
              {isSaved ? '★ Saved' : '☆ Save'}
            </button>
          )}
          {onClose != null && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close quiz panel"
              title="Close quiz panel"
            >
              <X size={18} />
            </button>
          )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {quizId == null ? (
          <p className="text-sm text-gray-500">Select a conversation.</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Questions will appear here when you request a quiz in this
            conversation.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Score: {totalScore}/{questions.length} · {answeredCount} answered
            </p>
            {questions.map((q) => {
              const options = parseOptions(q.options)
              const answered = q.status !== 'pending'
              const isSubmitting = submittingId === q.id
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <p className="mb-2 text-sm font-medium text-gray-800">
                    {q.questionOrder}. {q.title}
                  </p>
                  <div className="space-y-1">
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
                          className={`w-full rounded border px-3 py-2 text-left text-sm transition-colors ${
                            answered
                              ? 'cursor-default border-gray-200 bg-gray-50'
                              : 'border-gray-300 hover:bg-gray-100'
                          } ${showCorrect ? 'border-green-500 bg-green-50' : ''} ${
                            showWrong ? 'border-red-400 bg-red-50' : ''
                          } ${isChosen && !answered ? 'ring-1 ring-cyan-500' : ''}`}
                        >
                          <span className="font-medium">{key}.</span> {label}
                          {showCorrect && (
                            <span className="ml-2 text-xs text-green-600">
                              ✓ Correct
                            </span>
                          )}
                          {showWrong && (
                            <span className="ml-2 text-xs text-red-600">
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
