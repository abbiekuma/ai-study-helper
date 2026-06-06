import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { Star, List } from 'lucide-react'

export const Route = createFileRoute('/quiz' as any)({
  component: QuizLayout,
})

function QuizLayout() {
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      <aside className="w-56 shrink-0 border-r border-border bg-background p-4">
        <h2 className="mb-4 text-lg font-semibold text-stone-800">Quizzes</h2>
        <nav className="space-y-1">
          <Link
            to="/quiz/all"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-200"
            activeProps={{
              className:
                'flex items-center gap-2 rounded-lg px-3 py-2 bg-primary-muted text-primary-muted-foreground font-medium',
            }}
          >
            <List size={18} />
            All Quizzes
          </Link>
          <Link
            to="/quiz/saved"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-200"
            activeProps={{
              className:
                'flex items-center gap-2 rounded-lg px-3 py-2 bg-primary-muted text-primary-muted-foreground font-medium',
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
