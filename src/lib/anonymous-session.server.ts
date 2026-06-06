import { getCookie, setCookie } from '@tanstack/react-start/server'

const COOKIE_NAME = 'anonymous_session_id'

/** Browser session cookie: cleared when the browser closes. */
export function getOrCreateSessionId(): string {
  const existing = getCookie(COOKIE_NAME)
  if (existing) return existing

  const sessionId = crypto.randomUUID()
  setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return sessionId
}
