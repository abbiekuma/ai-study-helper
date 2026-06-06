// src/lib/chat.server.ts — only createServerFn; handlers load impl via dynamic import so client never loads db/gemini.
import { createServerFn } from '@tanstack/react-start'

async function getSessionId() {
  const m = await import('./anonymous-session.server')
  return m.getOrCreateSessionId()
}

export const getConversations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.getConversationsImpl(sessionId)
  },
)

export const getMessages = createServerFn({ method: 'GET' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.getMessagesImpl(sessionId, data)
  })

export const getQuizQuestions = createServerFn({ method: 'GET' })
  .inputValidator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizQuestionsImpl(sessionId, data)
  })

export const getQuizzes = createServerFn({ method: 'GET' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizzesImpl(sessionId, data)
  })

export const submitQuizAnswer = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { questionId: number; userAnswer: string }) =>
      data as { questionId: number; userAnswer: string },
  )
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.submitQuizAnswerImpl(sessionId, data)
  })

export const updateQuizSaved = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { quizId: number; isSaved: boolean }) =>
      data as { quizId: number; isSaved: boolean },
  )
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.updateQuizSavedImpl(sessionId, data)
  })

export const getAllQuizzesGroupedByConversation = createServerFn({
  method: 'GET',
}).handler(async () => {
  const sessionId = await getSessionId()
  const q = await import('./quiz.service')
  return q.getAllQuizzesGroupedByConversationImpl(sessionId)
})

export const getSavedQuizzes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getSavedQuizzesImpl(sessionId)
  },
)

export const getQuizById = createServerFn({ method: 'GET' })
  .inputValidator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizByIdImpl(sessionId, data)
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      conversationId?: number
      userMessage: string
      mode: 'beginner' | 'deep-dive' | 'quiz'
      apiKey?: string
      quizAction?: 'generate' | 'follow-up'
      activeQuizId?: number
    }) =>
      data as {
        conversationId?: number
        userMessage: string
        mode: 'beginner' | 'deep-dive' | 'quiz'
        apiKey?: string
        quizAction?: 'generate' | 'follow-up'
        activeQuizId?: number
      },
  )
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.sendMessageImpl(sessionId, data)
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.deleteConversationImpl(sessionId, data)
  })

/** Whether GEMINI_API_KEY is set in server env (e.g. .env.local). Does not expose the key. */
export const getGeminiKeyStatus = createServerFn({ method: 'GET' }).handler(
  async () => ({
    hasServerEnvKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
  }),
)
