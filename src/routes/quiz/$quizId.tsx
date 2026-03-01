import { createFileRoute, useParams } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  getQuizById,
  getQuizQuestions,
  submitQuizAnswer,
  updateQuizSaved,
} from '../../lib/chat.server'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/quiz/$quizId' as any)({
  component: QuizDetailPage,
})

type QuizMeta = Awaited<ReturnType<typeof getQuizById>>
type QuizQuestion = Awaited<ReturnType<typeof getQuizQuestions>>[number]

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

function parseOptions(optionsJson: string): Record<string, string> {
  try {
    const o = JSON.parse(optionsJson)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function QuizDetailPage() {
  const { quizId } = useParams({ from: '/quiz/$quizId' })
  const quizIdNum = Number(quizId)
  const getQuizByIdFn = useServerFn(getQuizById)
  const getQuestionsFn = useServerFn(getQuizQuestions)
  const updateSavedFn = useServerFn(updateQuizSaved)
  const submitAnswerFn = useServerFn(submitQuizAnswer)
  const [quiz, setQuiz] = useState<QuizMeta>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (Number.isNaN(quizIdNum)) return
    getQuizByIdFn({ data: { quizId: quizIdNum } }).then(setQuiz)
    getQuestionsFn({ data: { quizId: quizIdNum } })
      .then(setQuestions)
      .catch(() => setQuestions([]))
  }, [quizIdNum, getQuizByIdFn, getQuestionsFn])

  useEffect(() => {
    if (Number.isNaN(quizIdNum)) {
      setLoading(false)
      return
    }
    setLoading(true)
    getQuizByIdFn({ data: { quizId: quizIdNum } })
      .then(setQuiz)
      .catch(() => setQuiz(null))
    getQuestionsFn({ data: { quizId: quizIdNum } })
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }, [quizIdNum, getQuizByIdFn, getQuestionsFn])

  const handleToggleSaved = useCallback(() => {
    if (quiz == null) return
    updateSavedFn({
      data: { quizId: quiz.id, isSaved: !quiz.isSaved },
    }).then(() => refetch())
  }, [quiz, updateSavedFn, refetch])

  const handleSelect = useCallback(
    async (q: QuizQuestion, key: string) => {
      if (q.status !== 'pending' || submittingId != null) return
      setSubmittingId(q.id)
      try {
        await submitAnswerFn({ data: { questionId: q.id, userAnswer: key } })
        refetch()
      } catch (e) {
        console.error(e)
      } finally {
        setSubmittingId(null)
      }
    },
    [submitAnswerFn, refetch, submittingId],
  )

  if (loading) {
    return <div className="text-gray-500">Loading…</div>
  }

  if (quiz == null) {
    return (
      <div>
        <p className="text-gray-500">Quiz not found.</p>
      </div>
    )
  }

  const totalScore = questions.reduce((sum, q) => sum + (q.score ?? 0), 0)
  const answeredCount = questions.filter((q) => q.status !== 'pending').length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Quiz #{quiz.id}
          </h1>
          <p className="text-sm text-gray-500">
            {quiz.conversationTitle
              ? quiz.conversationTitle
              : `Chat ${quiz.conversationId}`}{' '}
            · {new Date(quiz.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleSaved}
          className="rounded px-3 py-1.5 text-sm font-medium text-cyan-600 hover:bg-cyan-50"
          title={quiz.isSaved ? 'Unsave quiz' : 'Save quiz'}
        >
          {quiz.isSaved ? '★ Saved' : '☆ Save'}
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-gray-500">No questions in this quiz.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            Score: {totalScore}/{questions.length} · {answeredCount} answered
          </p>
          <div className="space-y-4">
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
        </>
      )}
    </div>
  )
}
