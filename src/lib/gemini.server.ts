// src/lib/gemini.server.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  getSystemInstruction,
  type ChatMode,
  QUIZ_MCQ_GENERATION_SYSTEM,
  buildQuizMcqUserMessage,
} from './gemini.prompts.server'

export type { ChatMode } from './gemini.prompts.server'

export type HistoryMessage = { role: 'user' | 'assistant'; content: string }

// [2.4] 三个 mode 共用同一模型，只靠 prompt 区分
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

/**
 * [2.4] 通用入口：根据 mode 取 system instruction，调 Gemini，返回 AI 回复文本。
 * 替代原先各 mode 单独写一份的逻辑，只保留这一个函数。
 */
export async function generateReply(
  userMessage: string,
  history: HistoryMessage[],
  mode: ChatMode,
  apiKey: string,
): Promise<string> {
  const systemInstruction = getSystemInstruction(mode)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  })

  const parts = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
  parts.push({ role: 'user' as const, parts: [{ text: userMessage }] })

  const chat = model.startChat({
    history: parts.slice(0, -1),
  })
  const result = await chat.sendMessage(userMessage)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

// --- Quiz MCQ generation (step 2.3: structured output only) ---

/**
 * [2.4] Expected AI response structure for quiz generation (MCQ only).
 * The model must return a single JSON array. Each element must have:
 * - question: string (题干)
 * - options: object with keys "A", "B", "C", "D" and string values (选项文案)
 * - correctAnswer: string, one of "A" | "B" | "C" | "D"
 *
 * Example valid response:
 * [
 *   { "question": "async/await 是什么？", "options": { "A": "同步语法", "B": "处理异步的语法糖", "C": "一种框架", "D": "数据库 API" }, "correctAnswer": "B" },
 *   ...
 * ]
 */
export type McqItem = {
  question: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  correctAnswer: 'A' | 'B' | 'C' | 'D'
}

const MCQ_KEYS = ['A', 'B', 'C', 'D'] as const

/**
 * [2.5] Parse and validate AI quiz response.
 * - Strip markdown code block (```json ... ```) if present, then JSON.parse.
 * - Validate: non-empty array; each item has question (non-empty string), options (A/B/C/D non-empty strings), correctAnswer (A|B|C|D).
 * - On failure throws with a clear message; caller should catch, log, and not write to DB (e.g. show "出题失败，请再试一次").
 */

function stripJsonBlock(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m)
  return match ? match[1].trim() : trimmed
}

function parseAndValidateMcqArray(raw: string): McqItem[] {
  const jsonStr = stripJsonBlock(raw)
  let data: unknown
  try {
    data = JSON.parse(jsonStr)
  } catch {
    throw new Error('Quiz response is not valid JSON')
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Quiz response must be a non-empty array')
  }
  const result: McqItem[] = []
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item || typeof item !== 'object') {
      throw new Error(`Quiz item ${i + 1}: expected an object`)
    }
    const q = (item as Record<string, unknown>).question
    const opt = (item as Record<string, unknown>).options
    const ca = (item as Record<string, unknown>).correctAnswer
    if (typeof q !== 'string' || !q.trim()) {
      throw new Error(`Quiz item ${i + 1}: "question" must be a non-empty string`)
    }
    if (!opt || typeof opt !== 'object') {
      throw new Error(`Quiz item ${i + 1}: "options" must be an object`)
    }
    const options = opt as Record<string, unknown>
    const optionsOut: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' }
    for (const key of MCQ_KEYS) {
      const v = options[key]
      if (typeof v !== 'string' || !(v as string).trim()) {
        throw new Error(`Quiz item ${i + 1}: options.${key} must be a non-empty string`)
      }
      optionsOut[key] = (v as string).trim()
    }
    if (!MCQ_KEYS.includes(ca as 'A' | 'B' | 'C' | 'D')) {
      throw new Error(`Quiz item ${i + 1}: "correctAnswer" must be one of A, B, C, D`)
    }
    result.push({
      question: q.trim(),
      options: optionsOut,
      correctAnswer: ca as 'A' | 'B' | 'C' | 'D',
    })
  }
  return result
}

/**
 * Generate MCQs from a conversation context string. Calls Gemini with a strict JSON-only prompt,
 * then parses and validates the response. Throws on parse/validation failure.
 */
export async function generateQuizMcqs(
  conversationContext: string,
  apiKey: string,
): Promise<McqItem[]> {
  if (!conversationContext.trim()) {
    throw new Error('Conversation context is empty; cannot generate quiz')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: QUIZ_MCQ_GENERATION_SYSTEM,
  })

  const userMessage = buildQuizMcqUserMessage(conversationContext)

  const result = await model.generateContent(userMessage)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini for quiz generation')
  return parseAndValidateMcqArray(text)
}
