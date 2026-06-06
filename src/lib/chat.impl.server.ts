// Server-only implementation: db, gemini. Imported only inside server function handlers.
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, messages, quizzes } from '../db/schema'
import type { ChatMode, HistoryMessage } from './gemini.server'
import { generateReply } from './gemini.server'
import { resolveGeminiApiKey } from './gemini-api-key.server'
import {
  createQuizFromContext,
  getConversationContextForQuiz,
  isQuizGenerationRequest,
} from './quiz.service'

const BEGINNER_MODEL_NAME = 'gemini-2.5-flash-lite'

async function assertConversationAccess(
  conversationId: number,
  sessionId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.sessionId, sessionId),
      ),
    )
  if (!row) throw new Error('Conversation not found')
}

export async function getConversationsImpl(sessionId: string) {
  const rows = await db
    .select({
      id: conversations.id,
      mode: conversations.mode,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .orderBy(desc(conversations.createdAt))
  return rows
}

export async function getMessagesImpl(
  sessionId: string,
  data: { conversationId: number },
) {
  await assertConversationAccess(data.conversationId, sessionId)
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

export async function sendMessageImpl(
  sessionId: string,
  data: {
    conversationId?: number
    userMessage: string
    mode: ChatMode
    apiKey?: string
  },
) {
  const { conversationId: existingId, userMessage, mode } = data
  const apiKey = resolveGeminiApiKey(data.apiKey)

  let conversationId: number
  if (existingId != null) {
    await assertConversationAccess(existingId, sessionId)
    conversationId = existingId
  } else {
    const [row] = await db
      .insert(conversations)
      .values({ mode, sessionId })
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
      replyText = await generateReply(userMessage, history, mode, apiKey)
    } else if (isQuizGenerationRequest(userMessage)) {
      try {
        const { quizId, replyText: quizReplyText } =
          await createQuizFromContext({
            conversationId,
            context,
            sessionId,
            apiKey,
          })
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
      replyText = await generateReply(userMessage, history, mode, apiKey)
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
    replyText = await generateReply(userMessage, history, mode, apiKey)
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

/**
 * Delete a conversation. Saved quizzes (isSaved === true) are kept by setting
 * conversationId to null; other quizzes and all messages are cascade-deleted.
 */
export async function deleteConversationImpl(
  sessionId: string,
  data: { conversationId: number },
): Promise<void> {
  const { conversationId } = data
  await assertConversationAccess(conversationId, sessionId)
  await db
    .update(quizzes)
    .set({ conversationId: null })
    .where(
      and(
        eq(quizzes.conversationId, conversationId),
        eq(quizzes.isSaved, true),
        eq(quizzes.sessionId, sessionId),
      ),
    )
  await db.delete(conversations).where(eq(conversations.id, conversationId))
}
