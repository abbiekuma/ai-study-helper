import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { Star, List } from 'lucide-react'

export const Route = createFileRoute('/quiz' as any)({
  component: QuizLayout,
})

function QuizLayout() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Quizzes</h2>
        <nav className="space-y-1">
          <Link
            to="/quiz/all"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-200"
            activeProps={{
              className:
                'flex items-center gap-2 rounded-lg px-3 py-2 bg-cyan-100 text-cyan-800 font-medium',
            }}
          >
            <List size={18} />
            All Quizzes
          </Link>
          <Link
            to="/quiz/saved"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-200"
            activeProps={{
              className:
                'flex items-center gap-2 rounded-lg px-3 py-2 bg-cyan-100 text-cyan-800 font-medium',
            }}
          >
            <Star size={18} />
            Saved Quizzes
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
