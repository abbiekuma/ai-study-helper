// src/components/Header.tsx
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle2, ClipboardList, Home, KeyRound, Menu, Settings, X } from 'lucide-react'
import { useGeminiKey } from '../contexts/GeminiKeyContext'
import { useHomeChat } from '../contexts/HomeChatContext'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { hasKey, hasServerEnvKey, isConfigured, maskedKey } = useGeminiKey()
  const { goToNewChat } = useHomeChat()
  const location = useLocation()
  const navigate = useNavigate()

  const handleGoHome = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault()
      goToNewChat()
    } else {
      navigate({ to: '/' })
    }
  }

  const headerKeyLabel = hasKey
    ? maskedKey
    : hasServerEnvKey
      ? '.env.local'
      : null

  const isHome = location.pathname === '/'

  return (
    <>
      <header className="flex items-center justify-between gap-3 bg-nav p-4 text-[#f5f0eb] shadow-lg shadow-nav/20">
        <div className="flex min-w-0 items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-nav-hover"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-4 truncate text-xl font-semibold">
            <Link
              to="/"
              onClick={handleGoHome}
              className="flex items-center gap-2.5 hover:text-[#e8ddd6]"
            >
              <img
                src="/book_5773587.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
                decoding="async"
              />
              <span className="truncate">AI Study Helper</span>
            </Link>
          </h1>
        </div>
        {!isConfigured && isHome ? (
          <Link
            to="/settings"
            className="ml-4 flex min-w-0 shrink items-center gap-2 rounded-lg border border-accent/50 bg-accent/15 px-3 py-1.5 text-sm text-[#f5f0eb] transition-colors hover:bg-accent/25"
          >
            <KeyRound size={16} className="shrink-0 text-accent" aria-hidden />
            <span className="truncate">
              <span className="hidden sm:inline">Add your </span>
              <span className="font-medium underline-offset-2 hover:underline">
                Gemini API key
              </span>
              <span className="hidden md:inline"> in Settings</span>
            </span>
          </Link>
        ) : isConfigured && headerKeyLabel ? (
          <Link
            to="/settings"
            className="ml-4 flex shrink-0 items-center gap-2 rounded-lg border border-[#c4aea6]/30 bg-black/15 px-3 py-1.5 text-sm text-[#f0e8e4] transition-colors hover:bg-black/25"
            title={
              hasKey
                ? 'Gemini API key saved for this browser session'
                : 'Gemini API key from server environment (.env.local)'
            }
          >
            <CheckCircle2 size={16} className="shrink-0 text-[#d4bdb4]" aria-hidden />
            <span className="hidden sm:inline">Gemini API</span>
            <span className="font-mono text-xs text-[#e8ddd6]/90">{headerKeyLabel}</span>
          </Link>
        ) : null}
      </header>

      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-80 transform flex-col bg-nav text-[#f5f0eb] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-nav-border p-4">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-nav-hover"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <Link
            to="/"
            onClick={(e) => {
              setIsOpen(false)
              if (location.pathname === '/') {
                e.preventDefault()
                goToNewChat()
              }
            }}
            className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-nav-hover"
            activeProps={{
              className:
                'mb-2 flex items-center gap-3 rounded-lg bg-accent p-3 text-accent-foreground transition-colors hover:bg-accent/90',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>
          <Link
            to="/quiz"
            onClick={() => setIsOpen(false)}
            className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-nav-hover"
            activeProps={{
              className:
                'mb-2 flex items-center gap-3 rounded-lg bg-accent p-3 text-accent-foreground transition-colors hover:bg-accent/90',
            }}
          >
            <ClipboardList size={20} />
            <span className="font-medium">Quizzes</span>
          </Link>
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-nav-hover"
            activeProps={{
              className:
                'mb-2 flex items-center gap-3 rounded-lg bg-accent p-3 text-accent-foreground transition-colors hover:bg-accent/90',
            }}
          >
            <Settings size={20} />
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </aside>
    </>
  )
}
