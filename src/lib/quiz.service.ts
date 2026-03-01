// Quiz-only service: context, CRUD, and quiz generation. Used by chat.impl.server (sendMessage "考我") and chat.server (quiz server fn handlers).
import { and, asc, desc, eq, isNull, ne, or } from 'drizzle-orm'
import { db } from '../db/index'
import { messages, quizQuestions, quizzes } from '../db/schema'
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

export async function getQuizzesImpl(data: { conversationId: number }) {
  const rows = await db
    .select({
      id: quizzes.id,
      conversationId: quizzes.conversationId,
      createdAt: quizzes.createdAt,
      isSaved: quizzes.isSaved,
    })
    .from(quizzes)
    .where(eq(quizzes.conversationId, data.conversationId))
    .orderBy(desc(quizzes.createdAt))
  return rows
}

export async function getQuizQuestionsImpl(data: { quizId: number }) {
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

export async function updateQuizSavedImpl(data: {
  quizId: number
  isSaved: boolean
}) {
  await db
    .update(quizzes)
    .set({ isSaved: data.isSaved })
    .where(eq(quizzes.id, data.quizId))
  return { success: true }
}

/**
 * Generate MCQs from context, persist as one quiz + questions, return quizId and reply text.
 * Caller (sendMessageImpl) is responsible for inserting the assistant message and error handling.
 */
export async function createQuizFromContext(data: {
  conversationId: number
  context: string
}): Promise<{ quizId: number; replyText: string }> {
  const { conversationId, context } = data
  const mcqs = await generateQuizMcqs(context)
  const [quizRow] = await db
    .insert(quizzes)
    .values({
      conversationId,
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
