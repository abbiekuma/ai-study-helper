import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getAllQuizzesGroupedByConversation } from '../../lib/chat.server'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/quiz/all' as any)({
  component: AllQuizzesPage,
})

type Group = Awaited<
  ReturnType<typeof getAllQuizzesGroupedByConversation>
>[number]

function AllQuizzesPage() {
  const fn = useServerFn(getAllQuizzesGroupedByConversation)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fn()
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [fn])

  if (loading) {
    return <div className="text-gray-500">Loading…</div>
  }

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold text-gray-800">
          All Quizzes
        </h1>
        <p className="text-gray-500">
          No quizzes yet. Create a quiz from the Home chat by sending “考我” in
          Quiz mode.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-800">
        All Quizzes
      </h1>
      <p className="mb-6 text-sm text-gray-500">Grouped by chat.</p>
      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.conversationId}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-2 text-sm font-medium text-gray-500">
              Chat {group.conversationId}
              {group.title ? ` · ${group.title}` : ''}
            </h2>
            <ul className="space-y-2">
              {group.quizzes.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/quiz/$quizId"
                    params={{ quizId: String(q.id) }}
                    className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-800">
                      Quiz #{q.id}
                      <span className="ml-2 text-gray-400">
                        {new Date(q.createdAt).toLocaleString()}
                      </span>
                    </span>
                    {q.isSaved && (
                      <span className="text-xs text-amber-600">★ Saved</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
