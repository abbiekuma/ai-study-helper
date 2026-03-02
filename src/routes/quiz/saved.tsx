import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getSavedQuizzes } from '../../lib/chat.server'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/quiz/saved' as any)({
  component: SavedQuizzesPage,
})

type SavedQuiz = Awaited<ReturnType<typeof getSavedQuizzes>>[number]

function SavedQuizzesPage() {
  const fn = useServerFn(getSavedQuizzes)
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fn()
      .then(setQuizzes)
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false))
  }, [fn])

  if (loading) {
    return <div className="text-gray-500">Loading…</div>
  }

  if (quizzes.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold text-gray-800">
          Saved Quizzes
        </h1>
        <p className="text-gray-500">
          No saved quizzes. Save a quiz from its detail page or from the Home
          chat panel.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-800">
        Saved Quizzes
      </h1>
      <ul className="space-y-2">
        {quizzes.map((q) => (
          <li key={q.id}>
            <Link
              to="/quiz/$quizId"
              params={{ quizId: String(q.id) }}
              className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 shadow-sm hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-800">
                Quiz #{q.id}
                {q.conversationTitle
                  ? ` · ${q.conversationTitle}`
                  : q.conversationId != null
                    ? ` · Chat ${q.conversationId}`
                    : ' · Saved'}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(q.createdAt).toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
