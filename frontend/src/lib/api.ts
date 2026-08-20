import type {
  Build,
  ConversationDetail,
  ConversationSummary,
  CoreResponse,
  FactoryEvent,
  HealthResponse,
  Mode,
} from '../types'

const API_ROOT = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  core: () => request<CoreResponse>('/core'),
  conversations: () => request<ConversationSummary[]>('/conversations'),
  conversation: (id: string) => request<ConversationDetail>(`/conversations/${id}`),
  createConversation: () =>
    request<ConversationSummary>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'New build' }),
    }),
  deleteConversation: (id: string) =>
    request<void>(`/conversations/${id}`, { method: 'DELETE' }),
  build: (id: string) => request<Build>(`/builds/${id}`),
}

export async function streamMessage(
  conversationId: string,
  content: string,
  mode: Mode,
  onEvent: (event: FactoryEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_ROOT}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ content, mode }),
    signal,
  })

  if (!response.ok || !response.body) {
    let message = `Factory request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch {
      // Keep fallback.
    }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatchBlock = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (!dataLines.length) return
    const raw = dataLines.join('\n')
    onEvent({ event, data: JSON.parse(raw) as Record<string, unknown> })
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      if (block.trim()) dispatchBlock(block)
      boundary = buffer.indexOf('\n\n')
    }
    if (done) break
  }
  if (buffer.trim()) dispatchBlock(buffer)
}
