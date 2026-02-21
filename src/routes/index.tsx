import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ConversationList } from '../components/ConversationList'
import { ChatUI } from '../components/ChatUI'
import { QuizPanel } from '../components/QuizPanel'
import { getQuizQuestions } from '../lib/chat.server'
import { useServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/')({ component: HomePage })

type QuizQuestion = Awaited<ReturnType<typeof getQuizQuestions>>

function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion>([])
  const getQuizQuestionsFn = useServerFn(getQuizQuestions)

  // [4.2] Fetch quiz questions when conversation changes
  useEffect(() => {
    if (selectedConversationId == null) {
      setQuizQuestions([])
      return
    }
    getQuizQuestionsFn({ data: { conversationId: selectedConversationId } })
      .then(setQuizQuestions)
      .catch(() => setQuizQuestions([]))
  }, [selectedConversationId, getQuizQuestionsFn])

  // [4.3] Show middle column only when a conversation is selected and it has quiz questions
  const showQuizPanel =
    selectedConversationId != null && quizQuestions.length > 0

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ConversationList
        selectedId={selectedConversationId}
        onSelect={setSelectedConversationId}
      />
      {showQuizPanel && (
        <QuizPanel
          conversationId={selectedConversationId}
          questions={quizQuestions}
          onRefresh={() => {
            if (selectedConversationId != null) {
              getQuizQuestionsFn({
                data: { conversationId: selectedConversationId },
              }).then(setQuizQuestions)
            }
          }}
        />
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <ChatUI
          conversationId={selectedConversationId}
          onConversationCreated={setSelectedConversationId}
          onQuizGenerated={() => {
            if (selectedConversationId != null) {
              getQuizQuestionsFn({
                data: { conversationId: selectedConversationId },
              }).then(setQuizQuestions)
            }
          }}
        />
      </main>
    </div>
  )
}
