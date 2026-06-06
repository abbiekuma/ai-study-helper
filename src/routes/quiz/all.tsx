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
    return <div className="text-stone-500">Loading…</div>
  }

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold text-stone-800">
          All Quizzes
        </h1>
        <p className="text-stone-500">
          No quizzes yet. Learn a topic on Home, switch to Quiz mode, and send
          any message to generate one.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-stone-800">
        All Quizzes
      </h1>
      <p className="mb-6 text-sm text-stone-500">Grouped by chat.</p>
      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.conversationId}
            className="rounded-lg border border-stone-200 bg-card p-4 shadow-sm"
          >
            <h2 className="mb-2 text-sm font-medium text-stone-500">
              Chat {group.conversationId}
              {group.title ? ` · ${group.title}` : ''}
            </h2>
            <ul className="space-y-2">
              {group.quizzes.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/quiz/$quizId"
                    params={{ quizId: String(q.id) }}
                    className="flex items-center justify-between rounded border border-stone-200 px-3 py-2 hover:bg-sidebar-surface"
                  >
                    <span className="text-sm text-stone-800">
                      Quiz #{q.id}
                      <span className="ml-2 text-stone-400">
                        {new Date(q.createdAt).toLocaleString()}
                      </span>
                    </span>
                    {q.isSaved && (
                      <span className="text-xs text-amber-800">★ Saved</span>
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
