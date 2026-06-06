import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  hasGeminiApiKey,
  maskGeminiApiKey,
  setGeminiApiKey,
} from '../lib/gemini-key.client'

type GeminiKeyContextValue = {
  hasKey: boolean
  maskedKey: string | null
  saveKey: (key: string) => void
  removeKey: () => void
  getKeyForRequest: () => string | undefined
}

const GeminiKeyContext = createContext<GeminiKeyContextValue | null>(null)

export function GeminiKeyProvider({ children }: { children: ReactNode }) {
  const [hasKey, setHasKey] = useState(() => hasGeminiApiKey())
  const [maskedKey, setMaskedKey] = useState<string | null>(() => {
    const key = getGeminiApiKey()
    return key ? maskGeminiApiKey(key) : null
  })

  const saveKey = useCallback((key: string) => {
    setGeminiApiKey(key)
    setHasKey(true)
    setMaskedKey(maskGeminiApiKey(key))
  }, [])

  const removeKey = useCallback(() => {
    clearGeminiApiKey()
    setHasKey(false)
    setMaskedKey(null)
  }, [])

  const getKeyForRequest = useCallback(() => {
    const key = getGeminiApiKey()
    return key?.trim() || undefined
  }, [])

  const value = useMemo(
    () => ({ hasKey, maskedKey, saveKey, removeKey, getKeyForRequest }),
    [hasKey, maskedKey, saveKey, removeKey, getKeyForRequest],
  )

  return (
    <GeminiKeyContext.Provider value={value}>
      {children}
    </GeminiKeyContext.Provider>
  )
}

export function useGeminiKey() {
  const ctx = useContext(GeminiKeyContext)
  if (!ctx) {
    throw new Error('useGeminiKey must be used within GeminiKeyProvider')
  }
  return ctx
}
