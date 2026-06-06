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
    return <div className="text-stone-500">Loading…</div>
  }

  if (quiz == null) {
    return (
      <div>
        <p className="text-stone-500">Quiz not found.</p>
      </div>
    )
  }

  const totalScore = questions.reduce((sum, q) => sum + (q.score ?? 0), 0)
  const answeredCount = questions.filter((q) => q.status !== 'pending').length

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-quiz p-6">
      <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">
            Quiz #{quiz.id}
          </h1>
          <p className="text-sm text-stone-500">
            {quiz.conversationTitle
              ? quiz.conversationTitle
              : quiz.conversationId != null
                ? `Chat ${quiz.conversationId}`
                : 'Saved (chat deleted)'}{' '}
            · {new Date(quiz.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleSaved}
          className="rounded px-3 py-1.5 text-sm font-medium text-primary-muted-foreground hover:bg-primary-muted/50"
          title={quiz.isSaved ? 'Unsave quiz' : 'Save quiz'}
        >
          {quiz.isSaved ? '★ Saved' : '☆ Save'}
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-stone-500">No questions in this quiz.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-500">
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
                  className="rounded-lg border border-stone-200 bg-card p-3 shadow-sm"
                >
                  <p className="mb-2 text-sm font-medium text-stone-800">
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
                              ? 'cursor-default border-border bg-card'
                              : 'border-stone-300 hover:bg-stone-100'
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
        </>
      )}
    </div>
  )
}
