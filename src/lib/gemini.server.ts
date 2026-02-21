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
- Language: Respond in the user's preferred language.`

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
