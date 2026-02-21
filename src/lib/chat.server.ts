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
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const m = await import('./chat.impl.server')
    return m.getQuizQuestionsImpl(data)
  })

export const submitQuizAnswer = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { questionId: number; userAnswer: string }) =>
      data as { questionId: number; userAnswer: string },
  )
  .handler(async ({ data }) => {
    const m = await import('./chat.impl.server')
    return m.submitQuizAnswerImpl(data)
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
