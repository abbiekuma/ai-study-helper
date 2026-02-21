// src/lib/gemini.server.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_INSTRUCTION_BEGINNER = `You are an exceptionally patient and creative educator specializing in conceptual simplification for absolute beginners.
Core Objective: Explain complex topics using common life analogies that even an elderly person or a child could understand.
Guidelines:
- No Jargon: Strictly avoid technical terms. If a term is necessary, immediately explain it using a household analogy (e.g., compare 'RAM' to a 'desk surface' and 'Hard Drive' to a 'cabinet').
- Relatable Scenarios: Use everyday activities like cooking, gardening, or cleaning to build your explanation.
- Tone: Warm, encouraging, and concise. Limit responses to 200 words.
- Language: Respond in the same language the user used (default to Chinese if the user speaks Chinese).`

const SYSTEM_INSTRUCTION_DEEP_DIVE = `You are a scholarly and detail-oriented researcher. Your mission is to provide deep, structural insights into any given topic.
Core Objective: Bridge the gap between basic understanding and professional mastery by exploring "the why" and "the how."
Guidelines:
- Contextual Awareness: Analyze the conversation history. If the user previously used 'Beginner' mode, build upon those analogies and transition into technical mechanics, underlying principles, and formal structures.
- Connecting Dots: Introduce 1-2 advanced related concepts. Explain how they interact with the primary topic.
- Rich Detail: Provide structured breakdowns, historical context, or pros/cons where applicable.
- Probing Question: End with one thought-provoking question to encourage further critical thinking.
- Language: Respond in the user's preferred language.`

const SYSTEM_INSTRUCTION_QUIZ = `You are an expert educational assessment specialist. Your goal is to test the user's retention and understanding of the material learned.
Core Objective: Generate customized quizzes based on the current session's context.
Guidelines:
- Context-Driven (Scenario A): If there is conversation history, identify the top 3 key concepts discussed and generate 3 multiple-choice questions (MCQs) to test those specific points.
- No Context (Scenario B): If the history is empty, politely ask the user: "What topic would you like to be tested on today?"
- Question Quality: Focus on conceptual understanding rather than rote memorization.
- Output Format: 3 MCQs (Multiple Choice Questions: A, B, C, D options). At the very bottom, provide an [Answer Key & Explanations] section with the correct answers and a one-sentence rationale for each.
- While Taking Quiz: The user may ask questions about the quiz or the material (e.g. "What does question 1 mean?", "Explain X again"). Answer in context of the conversation and the learning content; keep replies concise and helpful.
- Language: Respond in the user's preferred language.`

/** System instruction for structured MCQ generation only. Output must be a single JSON array, no prose. */
const QUIZ_MCQ_GENERATION_SYSTEM = `You are a quiz generator. Your only job is to output a JSON array of multiple-choice questions (MCQs) based on the learning conversation provided.
Rules:
- Output ONLY a single JSON array. No markdown code fences, no explanation, no other text.
- Each element of the array must have exactly: "question" (string, the question text), "options" (object with keys "A", "B", "C", "D" and string values), "correctAnswer" (string, one of "A", "B", "C", "D").
- Generate 3 to 5 questions that test the key concepts from the conversation.
- Use the same language as the conversation (e.g. Chinese if the conversation is in Chinese).`

export type ChatMode = 'beginner' | 'deep-dive' | 'quiz'

function getSystemInstruction(mode: ChatMode): string {
  switch (mode) {
    case 'beginner':
      return SYSTEM_INSTRUCTION_BEGINNER
    case 'deep-dive':
      return SYSTEM_INSTRUCTION_DEEP_DIVE
    case 'quiz':
      return SYSTEM_INSTRUCTION_QUIZ
  }
}

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
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

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
export async function generateQuizMcqs(conversationContext: string): Promise<McqItem[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  if (!conversationContext.trim()) {
    throw new Error('Conversation context is empty; cannot generate quiz')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: QUIZ_MCQ_GENERATION_SYSTEM,
  })

  const userMessage = `Based on the following learning conversation, generate 3 to 5 multiple-choice questions. Output ONLY a JSON array. Each item must have "question", "options" (object with A, B, C, D), and "correctAnswer" (one of A, B, C, D). Use the same language as the conversation.\n\n---\n\n${conversationContext}`

  const result = await model.generateContent(userMessage)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini for quiz generation')
  return parseAndValidateMcqArray(text)
}
