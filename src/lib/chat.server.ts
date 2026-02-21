// src/lib/chat.server.ts
import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, messages } from '../db/schema'
import type { ChatMode, HistoryMessage } from './gemini.server'
import { generateReply } from './gemini.server'
import { desc } from 'drizzle-orm'

const BEGINNER_MODEL_NAME = 'gemini-2.5-flash-lite'

export const getConversations = createServerFn({ method: 'GET' }).handler(
  async () => {
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
  },
)

export const getMessages = createServerFn({ method: 'GET' })
  .inputValidator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
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
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      conversationId?: number
      userMessage: string
      mode: ChatMode
    }): {
      conversationId?: number
      userMessage: string
      mode: ChatMode
    } => data,
  )
  .handler(async ({ data }) => {
    const { conversationId: existingId, userMessage, mode } = data

    // 1. Get or create conversation (mode = user-selected for this send; new conv uses this mode)
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

    // 2. Insert user message (store mode so UI can show "user · Beginner" etc.)
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: userMessage,
      mode,
    })

    // 3. Load history for this conversation (for Gemini context)
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    // Exclude the user message we just inserted (last row) so Gemini only gets previous turns
    const history: HistoryMessage[] = rows.slice(0, -1).map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
    }))

    // 4. Call Gemini (mode = which button user clicked: Beginner / Deep-dive / Quiz)
    const replyText = await generateReply(userMessage, history, mode)

    // 5. Insert assistant message (model_used includes mode for later filtering/stats)
    await db.insert(messages).values({
      conversationId,
      role: 'assistant',
      content: replyText,
      mode,
      modelUsed: `${BEGINNER_MODEL_NAME} (${mode})`,
    })

    // 6. Return so client can show the new message (include mode for UI label)
    return {
      conversationId,
      assistantMessage: {
        role: 'assistant' as const,
        content: replyText,
        mode,
      },
    }
  })
