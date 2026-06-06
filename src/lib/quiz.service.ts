// Quiz-only service: context, CRUD, and quiz generation. Used by chat.impl.server (sendMessage "考我") and chat.server (quiz server fn handlers).
import { and, asc, desc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, messages, quizQuestions, quizzes } from '../db/schema'
import { generateQuizMcqs } from './gemini.server'

export function isQuizGenerationRequest(message: string): boolean {
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

async function assertQuizAccess(
  quizId: number,
  sessionId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.sessionId, sessionId)))
  if (!row) throw new Error('Quiz not found')
}

async function assertQuestionAccess(
  questionId: number,
  sessionId: string,
): Promise<number> {
  const [row] = await db
    .select({ quizId: quizQuestions.quizId, sessionId: quizzes.sessionId })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(eq(quizQuestions.id, questionId))
  if (!row || row.sessionId !== sessionId) {
    throw new Error('Question not found')
  }
  return row.quizId
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

export async function getQuizzesImpl(
  sessionId: string,
  data: { conversationId: number },
) {
  await assertConversationAccess(data.conversationId, sessionId)
  const rows = await db
    .select({
      id: quizzes.id,
      conversationId: quizzes.conversationId,
      createdAt: quizzes.createdAt,
      isSaved: quizzes.isSaved,
    })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.conversationId, data.conversationId),
        eq(quizzes.sessionId, sessionId),
      ),
    )
    .orderBy(desc(quizzes.createdAt))
  return rows
}

export async function getQuizQuestionsImpl(
  sessionId: string,
  data: { quizId: number },
) {
  await assertQuizAccess(data.quizId, sessionId)
  const rows = await db
    .select({
      id: quizQuestions.id,
      quizId: quizQuestions.quizId,
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
    .where(eq(quizQuestions.quizId, data.quizId))
    .orderBy(asc(quizQuestions.questionOrder))
  return rows
}

export async function submitQuizAnswerImpl(
  sessionId: string,
  data: { questionId: number; userAnswer: string },
) {
  const { questionId, userAnswer } = data
  await assertQuestionAccess(questionId, sessionId)
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

export async function updateQuizSavedImpl(
  sessionId: string,
  data: { quizId: number; isSaved: boolean },
) {
  await assertQuizAccess(data.quizId, sessionId)
  await db
    .update(quizzes)
    .set({ isSaved: data.isSaved })
    .where(
      and(eq(quizzes.id, data.quizId), eq(quizzes.sessionId, sessionId)),
    )
  return { success: true }
}

/**
 * Generate MCQs from context, persist as one quiz + questions, return quizId and reply text.
 * Caller (sendMessageImpl) is responsible for inserting the assistant message and error handling.
 */
export async function createQuizFromContext(data: {
  conversationId: number
  context: string
  sessionId: string
  apiKey: string
}): Promise<{ quizId: number; replyText: string }> {
  const { conversationId, context, sessionId, apiKey } = data
  const mcqs = await generateQuizMcqs(context, apiKey)
  const [quizRow] = await db
    .insert(quizzes)
    .values({
      conversationId,
      sessionId,
      isSaved: false,
    })
    .returning({ id: quizzes.id })
  if (!quizRow) throw new Error('Failed to create quiz row')
  const quizId = quizRow.id
  for (let i = 0; i < mcqs.length; i++) {
    await db.insert(quizQuestions).values({
      quizId,
      title: mcqs[i].question,
      options: JSON.stringify(mcqs[i].options),
      correctAnswer: mcqs[i].correctAnswer,
      questionOrder: i + 1,
      status: 'pending',
    })
  }
  const replyText = `I've added ${mcqs.length} questions. Answer them in the quiz panel on the right.`
  return { quizId, replyText }
}

export type QuizGroupItem = {
  conversationId: number
  title: string | null
  mode: string
  createdAt: Date
  quizzes: Array<{ id: number; createdAt: Date; isSaved: boolean }>
}

export async function getAllQuizzesGroupedByConversationImpl(
  sessionId: string,
): Promise<QuizGroupItem[]> {
  const rows = await db
    .select({
      quizId: quizzes.id,
      quizCreatedAt: quizzes.createdAt,
      quizIsSaved: quizzes.isSaved,
      conversationId: conversations.id,
      title: conversations.title,
      mode: conversations.mode,
      conversationCreatedAt: conversations.createdAt,
    })
    .from(quizzes)
    .innerJoin(conversations, eq(quizzes.conversationId, conversations.id))
    .where(
      and(
        isNotNull(quizzes.conversationId),
        eq(conversations.sessionId, sessionId),
        eq(quizzes.sessionId, sessionId),
      ),
    )
    .orderBy(desc(conversations.createdAt), desc(quizzes.createdAt))
  const byConv = new Map<
    number,
    {
      conversationId: number
      title: string | null
      mode: string
      createdAt: Date
      quizzes: Array<{ id: number; createdAt: Date; isSaved: boolean }>
    }
  >()
  for (const r of rows) {
    let group = byConv.get(r.conversationId)
    if (!group) {
      group = {
        conversationId: r.conversationId,
        title: r.title,
        mode: r.mode,
        createdAt: r.conversationCreatedAt,
        quizzes: [],
      }
      byConv.set(r.conversationId, group)
    }
    group.quizzes.push({
      id: r.quizId,
      createdAt: r.quizCreatedAt,
      isSaved: r.quizIsSaved,
    })
  }
  return Array.from(byConv.values())
}

export type SavedQuizItem = {
  id: number
  conversationId: number | null
  createdAt: Date
  isSaved: boolean
  conversationTitle: string | null
}

export async function getSavedQuizzesImpl(
  sessionId: string,
): Promise<SavedQuizItem[]> {
  const rows = await db
    .select({
      id: quizzes.id,
      conversationId: quizzes.conversationId,
      createdAt: quizzes.createdAt,
      isSaved: quizzes.isSaved,
      conversationTitle: conversations.title,
    })
    .from(quizzes)
    .leftJoin(conversations, eq(quizzes.conversationId, conversations.id))
    .where(and(eq(quizzes.isSaved, true), eq(quizzes.sessionId, sessionId)))
    .orderBy(desc(quizzes.createdAt))
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    createdAt: r.createdAt,
    isSaved: r.isSaved,
    conversationTitle: r.conversationTitle,
  }))
}

export async function getQuizByIdImpl(
  sessionId: string,
  data: { quizId: number },
): Promise<{
  id: number
  conversationId: number | null
  createdAt: Date
  isSaved: boolean
  conversationTitle: string | null
} | null> {
  const [row] = await db
    .select({
      id: quizzes.id,
      conversationId: quizzes.conversationId,
      createdAt: quizzes.createdAt,
      isSaved: quizzes.isSaved,
      conversationTitle: conversations.title,
      sessionId: quizzes.sessionId,
    })
    .from(quizzes)
    .leftJoin(conversations, eq(quizzes.conversationId, conversations.id))
    .where(eq(quizzes.id, data.quizId))
  if (!row || row.sessionId !== sessionId) return null
  return {
    id: row.id,
    conversationId: row.conversationId,
    createdAt: row.createdAt,
    isSaved: row.isSaved,
    conversationTitle: row.conversationTitle,
  }
}
