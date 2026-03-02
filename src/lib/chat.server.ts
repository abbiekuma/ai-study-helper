// src/lib/chat.server.ts — only createServerFn; handlers load impl via dynamic import so client never loads db/gemini.
import { createServerFn } from '@tanstack/react-start'

export const getConversations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const m = await import('./chat.impl.server')
    return m.getConversationsImpl()
  },
)

export const getMessages = createServerFn({ method: 'GET' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const m = await import('./chat.impl.server')
    return m.getMessagesImpl(data)
  })

export const getQuizQuestions = createServerFn({ method: 'GET' })
  .inputValidator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const q = await import('./quiz.service')
    return q.getQuizQuestionsImpl(data)
  })

export const getQuizzes = createServerFn({ method: 'GET' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const q = await import('./quiz.service')
    return q.getQuizzesImpl(data)
  })

export const submitQuizAnswer = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { questionId: number; userAnswer: string }) =>
      data as { questionId: number; userAnswer: string },
  )
  .handler(async ({ data }) => {
    const q = await import('./quiz.service')
    return q.submitQuizAnswerImpl(data)
  })

export const updateQuizSaved = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { quizId: number; isSaved: boolean }) =>
      data as { quizId: number; isSaved: boolean },
  )
  .handler(async ({ data }) => {
    const q = await import('./quiz.service')
    return q.updateQuizSavedImpl(data)
  })

export const getAllQuizzesGroupedByConversation = createServerFn({
  method: 'GET',
}).handler(async () => {
  const q = await import('./quiz.service')
  return q.getAllQuizzesGroupedByConversationImpl()
})

export const getSavedQuizzes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const q = await import('./quiz.service')
    return q.getSavedQuizzesImpl()
  },
)

export const getQuizById = createServerFn({ method: 'GET' })
  .inputValidator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const q = await import('./quiz.service')
    return q.getQuizByIdImpl(data)
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      conversationId?: number
      userMessage: string
      mode: 'beginner' | 'deep-dive' | 'quiz'
    }) =>
      data as {
        conversationId?: number
        userMessage: string
        mode: 'beginner' | 'deep-dive' | 'quiz'
      },
  )
  .handler(async ({ data }) => {
    const m = await import('./chat.impl.server')
    return m.sendMessageImpl(data)
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const m = await import('./chat.impl.server')
    return m.deleteConversationImpl(data)
  })
