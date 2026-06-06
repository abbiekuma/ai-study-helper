import { Link } from '@tanstack/react-router'

const STEPS = [
  {
    title: 'Learn',
    body: 'Pick Beginner or Deep-dive and chat about any topic. Beginner uses simple analogies; Deep-dive goes into more detail.',
  },
  {
    title: 'Quiz',
    body: 'Switch to Quiz and send a message. The app builds multiple-choice questions from your study chat and opens the quiz panel.',
  },
  {
    title: 'Answer & ask',
    body: 'Click options in the quiz panel to check your answers. Use Follow-up in chat to ask about a question, or New Quiz for another set.',
  },
  {
    title: 'Save',
    body: 'Star a quiz to keep it under Quizzes → Saved, even if you delete the original chat.',
  },
] as const

export function HomeIntro() {
  return (
    <div className="mx-auto max-w-xl py-6">
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        Learn, then quiz yourself
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        AI Study Helper is a study companion powered by Gemini. Learn a topic in
        chat, generate quizzes from that conversation, and review what you
        remember—all in one place.
      </p>

      <ol className="mb-6 space-y-4">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-lg border border-border bg-card p-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm text-muted-foreground">
        Click{' '}
        <span className="font-medium text-foreground">New chat</span> on the
        left, choose a mode below, and send your first message. Add your Gemini
        API key in{' '}
        <Link to="/settings" className="font-medium text-foreground underline">
          Settings
        </Link>{' '}
        if you have not already.
      </p>
    </div>
  )
}
