// src/components/Header/tsx
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle2, ClipboardList, Home, Menu, Settings, X } from 'lucide-react'
import { useGeminiKey } from '../contexts/GeminiKeyContext'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { hasKey, hasServerEnvKey, isConfigured, maskedKey } = useGeminiKey()

  const headerKeyLabel = hasKey
    ? maskedKey
    : hasServerEnvKey
      ? '.env.local'
      : null

  return (
    <>
      <header className="flex items-center justify-between bg-gray-800 p-4 text-white shadow-lg">
        <div className="flex min-w-0 items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-700"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-4 truncate text-xl font-semibold">
            <Link to="/" className="hover:opacity-90">
              AI Study Helper
            </Link>
          </h1>
        </div>
        {isConfigured && headerKeyLabel ? (
          <Link
            to="/settings"
            className="ml-4 flex shrink-0 items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-sm text-cyan-100 transition-colors hover:bg-cyan-900/50"
            title={
              hasKey
                ? 'Gemini API key saved for this browser session'
                : 'Gemini API key from server environment (.env.local)'
            }
          >
            <CheckCircle2 size={16} className="shrink-0 text-cyan-400" aria-hidden />
            <span className="hidden sm:inline">Gemini API</span>
            <span className="font-mono text-xs text-cyan-200/90">{headerKeyLabel}</span>
          </Link>
        ) : null}
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>
          <Link
            to="/quiz"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <ClipboardList size={20} />
            <span className="font-medium">Quizzes</span>
          </Link>
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
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
