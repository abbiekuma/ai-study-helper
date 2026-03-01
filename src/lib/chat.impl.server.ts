// Server-only implementation: db, gemini. Imported only inside server function handlers.
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, messages } from '../db/schema'
import type { ChatMode, HistoryMessage } from './gemini.server'
import { generateReply } from './gemini.server'
import {
  createQuizFromContext,
  getConversationContextForQuiz,
  isQuizGenerationRequest,
} from './quiz.service'

const BEGINNER_MODEL_NAME = 'gemini-2.5-flash-lite'

export async function getConversationsImpl() {
  const rows = await db
    .select({
      id: conversations.id,
      mode: conversations.mode,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
  return rows
}

export async function getMessagesImpl(data: { conversationId: number }) {
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      mode: messages.mode,
      modelUsed: messages.modelUsed,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, data.conversationId))
    .orderBy(asc(messages.createdAt))
  return rows
}

export async function sendMessageImpl(data: {
  conversationId?: number
  userMessage: string
  mode: ChatMode
}) {
  const { conversationId: existingId, userMessage, mode } = data

  let conversationId: number
  if (existingId != null) {
    conversationId = existingId
  } else {
    const [row] = await db
      .insert(conversations)
      .values({ mode })
      .returning({ id: conversations.id })
    if (!row) throw new Error('Failed to create conversation')
    conversationId = row.id
  }

  await db.insert(messages).values({
    conversationId,
    role: 'user',
    content: userMessage,
    mode,
  })

  let replyText: string

  if (mode === 'quiz') {
    const context = await getConversationContextForQuiz(conversationId)
    if (!context.trim()) {
      const history: HistoryMessage[] = []
      replyText = await generateReply(userMessage, history, mode)
    } else if (isQuizGenerationRequest(userMessage)) {
      try {
        const { quizId, replyText: quizReplyText } =
          await createQuizFromContext({ conversationId, context })
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: quizReplyText,
          mode,
          modelUsed: `${BEGINNER_MODEL_NAME} (${mode})`,
        })
        return {
          conversationId,
          assistantMessage: {
            role: 'assistant' as const,
            content: quizReplyText,
            mode,
          },
          quizId,
        }
      } catch (e) {
        const errMessage = e instanceof Error ? e.message : String(e)
        console.error('Quiz generation failed:', e)
        replyText = `Quiz generation failed: ${errMessage}. Please try again.`
      }
    } else {
      const rows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
      const history: HistoryMessage[] = rows.slice(0, -1).map((r) => ({
        role: r.role as 'user' | 'assistant',
        content: r.content,
      }))
      replyText = await generateReply(userMessage, history, mode)
    }
  } else {
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
    const history: HistoryMessage[] = rows.slice(0, -1).map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
    }))
    replyText = await generateReply(userMessage, history, mode)
  }

  await db.insert(messages).values({
    conversationId,
    role: 'assistant',
    content: replyText,
    mode,
    modelUsed: `${BEGINNER_MODEL_NAME} (${mode})`,
  })

  return {
    conversationId,
    assistantMessage: {
      role: 'assistant' as const,
      content: replyText,
      mode,
    },
  }
}
