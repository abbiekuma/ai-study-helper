const STORAGE_KEY = 'geminiApiKey'

export function getGeminiApiKey(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(STORAGE_KEY)
}

export function setGeminiApiKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key.trim())
}

export function clearGeminiApiKey(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function hasGeminiApiKey(): boolean {
  const key = getGeminiApiKey()
  return Boolean(key?.trim())
}

export function maskGeminiApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}
