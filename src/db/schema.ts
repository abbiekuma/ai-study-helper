// src/db/schema.ts
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Chat mode: which AI and behavior to use
export const chatModeEnum = pgEnum('chat_mode', [
  'beginner',
  'deep-dive',
  'quiz',
])

// Who sent the message
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant'])

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  mode: chatModeEnum('mode').notNull(),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  mode: chatModeEnum('mode'), // which mode was used for this message (user choice or assistant reply)
  modelUsed: text('model_used'), // e.g. 'Gemini 2.0 Flash'; only for assistant messages
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// One row per "quiz" (one "考我" generation). One conversation has many quizzes.
export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isSaved: boolean('is_saved').notNull().default(false),
})

// One row per question (MCQ). Each question belongs to one quiz.
export const quizQuestions = pgTable('quiz_questions', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id')
    .notNull()
    .references(() => quizzes.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), // 题干
  options: text('options').notNull(), // JSON: {"A":"...","B":"...","C":"...","D":"..."}
  correctAnswer: text('correct_answer').notNull(), // "A" | "B" | "C" | "D"
  questionOrder: integer('question_order').notNull(),
  status: text('status').notNull().default('pending'), // e.g. pending, answered, correct, incorrect
  userAnswer: text('user_answer'),
  score: integer('score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Relations
export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  quizzes: many(quizzes),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [quizzes.conversationId],
    references: [conversations.id],
  }),
  questions: many(quizQuestions),
}))

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}))
