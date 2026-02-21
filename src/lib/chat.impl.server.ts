// Server-only implementation: db, gemini. Imported only inside server function handlers.
import { and, asc, desc, eq, isNull, ne, or } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, messages, quizQuestions } from '../db/schema'
import type { ChatMode, HistoryMessage } from './gemini.server'
import { generateReply, generateQuizMcqs } from './gemini.server'

const BEGINNER_MODEL_NAME = 'gemini-2.5-flash-lite'

function isQuizGenerationRequest(message: string): boolean {
  const t = message.trim().toLowerCase()
  const quizKeywords = [
    '考',
    '出题',
    '测验',
    'quiz me',
    'test me',
    'generate quiz',
    '出几道题',
    '考考',
  ]
  return quizKeywords.some((k) => t.includes(k.toLowerCase()))
}

export async function getConversationContextForQuiz(
  conversationId: number,
): Promise<string> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        or(isNull(messages.mode), ne(messages.mode, 'quiz')),
      ),
    )
    .orderBy(asc(messages.createdAt))
  return rows
    .map((r) => `${r.role === 'user' ? 'User' : 'Assistant'}: ${r.content}`)
    .join('\n\n')
}

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

export async function getQuizQuestionsImpl(data: { conversationId: number }) {
  const rows = await db
    .select({
      id: quizQuestions.id,
      conversationId: quizQuestions.conversationId,
      title: quizQuestions.title,
      options: quizQuestions.options,
      correctAnswer: quizQuestions.correctAnswer,
      questionOrder: quizQuestions.questionOrder,
      status: quizQuestions.status,
      userAnswer: quizQuestions.userAnswer,
      score: quizQuestions.score,
      createdAt: quizQuestions.createdAt,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.conversationId, data.conversationId))
    .orderBy(asc(quizQuestions.questionOrder))
  return rows
}

export async function submitQuizAnswerImpl(data: {
  questionId: number
  userAnswer: string
}) {
  const { questionId, userAnswer } = data
  const key = userAnswer.trim().toUpperCase() as 'A' | 'B' | 'C' | 'D'
  if (!['A', 'B', 'C', 'D'].includes(key)) {
    throw new Error('userAnswer must be one of A, B, C, D')
  }
  const [row] = await db
    .select({ correctAnswer: quizQuestions.correctAnswer })
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
  if (!row) throw new Error('Question not found')
  const correct = row.correctAnswer === key
  await db
    .update(quizQuestions)
    .set({
      userAnswer: key,
      status: correct ? 'correct' : 'incorrect',
      score: correct ? 1 : 0,
    })
    .where(eq(quizQuestions.id, questionId))
  return { correct, correctAnswer: row.correctAnswer }
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
        const mcqs = await generateQuizMcqs(context)
        await db
          .delete(quizQuestions)
          .where(eq(quizQuestions.conversationId, conversationId))
        for (let i = 0; i < mcqs.length; i++) {
          await db.insert(quizQuestions).values({
            conversationId,
            title: mcqs[i].question,
            options: JSON.stringify(mcqs[i].options),
            correctAnswer: mcqs[i].correctAnswer,
            questionOrder: i + 1,
            status: 'pending',
          })
        }
        replyText = `I've added ${mcqs.length} questions. Answer them in the quiz panel on the right.`
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
