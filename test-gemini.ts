import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function test() {
  // Use stable model ID (gemini-2.0-flash-exp may be deprecated/renamed)
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })
  const result = await model.generateContent('Hello')
  console.log(result.response.text())
}

test().catch(console.error)
