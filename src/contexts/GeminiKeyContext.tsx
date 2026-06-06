import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getGeminiKeyStatus } from '../lib/chat.server'
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  hasGeminiApiKey,
  maskGeminiApiKey,
  setGeminiApiKey,
} from '../lib/gemini-key.client'

type GeminiKeyContextValue = {
  hasKey: boolean
  hasServerEnvKey: boolean
  isConfigured: boolean
  maskedKey: string | null
  saveKey: (key: string) => void
  removeKey: () => void
  getKeyForRequest: () => string | undefined
}

const GeminiKeyContext = createContext<GeminiKeyContextValue | null>(null)

export function GeminiKeyProvider({ children }: { children: ReactNode }) {
  const getGeminiKeyStatusFn = useServerFn(getGeminiKeyStatus)
  const [hasKey, setHasKey] = useState(() => hasGeminiApiKey())
  const [hasServerEnvKey, setHasServerEnvKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(() => {
    const key = getGeminiApiKey()
    return key ? maskGeminiApiKey(key) : null
  })

  useEffect(() => {
    getGeminiKeyStatusFn()
      .then((status) => setHasServerEnvKey(status.hasServerEnvKey))
      .catch(() => setHasServerEnvKey(false))
  }, [getGeminiKeyStatusFn])

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

  const isConfigured = hasKey || hasServerEnvKey

  const value = useMemo(
    () => ({
      hasKey,
      hasServerEnvKey,
      isConfigured,
      maskedKey,
      saveKey,
      removeKey,
      getKeyForRequest,
    }),
    [
      hasKey,
      hasServerEnvKey,
      isConfigured,
      maskedKey,
      saveKey,
      removeKey,
      getKeyForRequest,
    ],
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
