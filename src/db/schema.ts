// src/db/schema.ts
import {
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

// Relations: one conversation has many messages
export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))
