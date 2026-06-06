import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

type HomeChatContextValue = {
  goToNewChat: () => void
  registerGoToNewChat: (fn: () => void) => () => void
}

const HomeChatContext = createContext<HomeChatContextValue | null>(null)

export function HomeChatProvider({ children }: { children: ReactNode }) {
  const goToNewChatRef = useRef<(() => void) | null>(null)

  const registerGoToNewChat = useCallback((fn: () => void) => {
    goToNewChatRef.current = fn
    return () => {
      if (goToNewChatRef.current === fn) {
        goToNewChatRef.current = null
      }
    }
  }, [])

  const goToNewChat = useCallback(() => {
    goToNewChatRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ goToNewChat, registerGoToNewChat }),
    [goToNewChat, registerGoToNewChat],
  )

  return (
    <HomeChatContext.Provider value={value}>{children}</HomeChatContext.Provider>
  )
}

export function useHomeChat() {
  const ctx = useContext(HomeChatContext)
  if (!ctx) {
    throw new Error('useHomeChat must be used within HomeChatProvider')
  }
  return ctx
}
