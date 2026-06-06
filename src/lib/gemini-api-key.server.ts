/** Prefer request BYOK key; fall back to env for local development. */
export function resolveGeminiApiKey(requestApiKey?: string): string {
  const fromRequest = requestApiKey?.trim()
  if (fromRequest) return fromRequest

  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) return fromEnv

  throw new Error(
    'Gemini API key required. Add yours in Settings (or set GEMINI_API_KEY for local dev).',
  )
}
