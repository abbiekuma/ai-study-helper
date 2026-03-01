import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/quiz/' as any)({
  component: QuizIndexPage,
})

function QuizIndexPage() {
  return <Navigate to="/quiz/all" />
}
