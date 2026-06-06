import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useGeminiKey } from '../contexts/GeminiKeyContext'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { hasKey, hasServerEnvKey, maskedKey, saveKey, removeKey } =
    useGeminiKey()
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
      <h1 className="mb-2 text-2xl font-semibold text-stone-900">Settings</h1>
      <p className="mb-6 text-sm text-stone-600">
        This portfolio demo uses <strong>bring-your-own-key</strong>. Your Gemini
        API key is stored in this browser tab&apos;s session only (cleared when
        you close the browser). It is sent over HTTPS when you chat but is{' '}
        <strong>not saved on our server</strong>.
      </p>

      {hasServerEnvKey ? (
        <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0 text-amber-800"
            aria-hidden
          />
          <div>
            <p className="font-medium">Gemini API connected via .env.local</p>
            <p className="mt-1 text-amber-900">
              The server is using <code className="rounded bg-amber-100/80 px-1">GEMINI_API_KEY</code>{' '}
              from your environment file. You can chat without saving a key below.
              A key saved here overrides the env key for this browser session.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-lg border border-primary-muted bg-primary-muted/50 p-4 text-sm text-primary-muted-foreground">
        <p className="font-medium">Chats are private to this browser session</p>
        <p className="mt-1 text-primary-muted-foreground">
          Closing the browser starts fresh. Other visitors cannot see your
          conversations.
        </p>
      </div>

      <label className="mb-1 block text-sm font-medium text-stone-700">
        Gemini API Key
      </label>
      <p className="mb-2 text-xs text-stone-500">
        Get a free key from{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-primary-muted-foreground underline hover:text-primary-muted-foreground"
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
        className="mb-3 w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hasKey && maskedKey ? (
        <p className="mb-3 text-sm text-stone-600">
          Session key:{' '}
          <code className="rounded bg-stone-100 px-1">{maskedKey}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!input.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          Save key
        </button>
        {hasKey ? (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-sidebar-surface"
          >
            Remove key
          </button>
        ) : null}
        <Link
          to="/"
          className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-sidebar-surface"
        >
          Back to chat
        </Link>
      </div>
      {saved ? (
        <p className="mt-3 text-sm text-primary-muted-foreground">Key saved for this session.</p>
      ) : null}
    </div>
  )
}
