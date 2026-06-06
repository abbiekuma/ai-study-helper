import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useGeminiKey } from '../contexts/GeminiKeyContext'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { hasKey, maskedKey, saveKey, removeKey } = useGeminiKey()
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    saveKey(trimmed)
    setInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    removeKey()
    setInput('')
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Settings</h1>
      <p className="mb-6 text-sm text-gray-600">
        This portfolio demo uses <strong>bring-your-own-key</strong>. Your Gemini
        API key is stored in this browser tab&apos;s session only (cleared when
        you close the browser). It is sent over HTTPS when you chat but is{' '}
        <strong>not saved on our server</strong>.
      </p>

      <div className="mb-6 rounded-lg border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900">
        <p className="font-medium">Chats are private to this browser session</p>
        <p className="mt-1 text-cyan-800">
          Closing the browser starts fresh. Other visitors cannot see your
          conversations.
        </p>
      </div>

      <label className="mb-1 block text-sm font-medium text-gray-700">
        Gemini API Key
      </label>
      <p className="mb-2 text-xs text-gray-500">
        Get a free key from{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-cyan-600 underline hover:text-cyan-700"
        >
          Google AI Studio
        </a>
        .
      </p>
      <input
        type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={hasKey ? 'Paste a new key to replace' : 'Paste your API key'}
        className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      {hasKey && maskedKey ? (
        <p className="mb-3 text-sm text-gray-600">
          Current key: <code className="rounded bg-gray-100 px-1">{maskedKey}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!input.trim()}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          Save key
        </button>
        {hasKey ? (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Remove key
          </button>
        ) : null}
        <Link
          to="/"
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Back to chat
        </Link>
      </div>
      {saved ? (
        <p className="mt-3 text-sm text-green-600">Key saved for this session.</p>
      ) : null}
    </div>
  )
}
