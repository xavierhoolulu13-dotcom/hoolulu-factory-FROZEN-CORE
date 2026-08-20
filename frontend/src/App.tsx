import { useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, LockKeyhole, Menu, Sparkles } from 'lucide-react'
import { api, streamMessage } from './lib/api'
import type {
  Build,
  ConversationDetail,
  ConversationSummary,
  CoreResponse,
  HealthResponse,
  Message,
  Mode,
  ProgressItem,
} from './types'
import { BrandMark } from './components/BrandMark'
import { BuildPanel } from './components/BuildPanel'
import { Composer } from './components/Composer'
import { CoreModal } from './components/CoreModal'
import { EmptyState } from './components/EmptyState'
import { MessageList } from './components/MessageList'
import { Sidebar } from './components/Sidebar'
import './styles.css'

function buildFrom(value: unknown): Build | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null
  return value as Build
}

export default function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<Mode>('build')
  const [busy, setBusy] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [core, setCore] = useState<CoreResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [showCore, setShowCore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const hasConversation = Boolean(detail?.messages.length)
  const activeTitle = detail?.title ?? 'New build'

  const refreshConversations = async () => {
    const items = await api.conversations()
    setConversations(items)
    return items
  }

  useEffect(() => {
    void refreshConversations().catch(() => setToast('Could not load build history.'))
    void api.core().then(setCore).catch(() => setToast('Frozen Core verification failed.'))
    void api.health().then(setHealth).catch(() => setToast('Factory backend is offline.'))
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!busy) newConversation()
      }
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        setShowCore(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const newConversation = () => {
    setActiveId(null)
    setDetail(null)
    setDraft('')
    setStreamingText('')
    setProgress([])
    setCurrentBuild(null)
    setPanelOpen(false)
    setSidebarOpen(false)
  }

  const selectConversation = async (id: string) => {
    if (busy || id === activeId) return
    try {
      const selected = await api.conversation(id)
      setActiveId(id)
      setDetail(selected)
      setCurrentBuild(selected.builds[0] ?? null)
      setProgress([])
      setPanelOpen(false)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not open that conversation.')
    }
  }

  const deleteConversation = async (id: string) => {
    const item = conversations.find((conversation) => conversation.id === id)
    if (!window.confirm(`Delete “${item?.title ?? 'this build'}” and its artifacts?`)) return
    try {
      await api.deleteConversation(id)
      if (activeId === id) newConversation()
      await refreshConversations()
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not delete that build.')
    }
  }

  const send = async () => {
    const content = draft.trim()
    if (!content || busy) return

    setBusy(true)
    setDraft('')
    setStreamingText('')
    setProgress([])
    if (mode === 'build') {
      setCurrentBuild(null)
      setPanelOpen(true)
    }

    let conversationId = activeId
    let baseDetail = detail

    try {
      if (!conversationId) {
        const created = await api.createConversation()
        conversationId = created.id
        setActiveId(created.id)
        baseDetail = { ...created, messages: [], builds: [] }
        setDetail(baseDetail)
        await refreshConversations()
      }

      const optimistic: Message = {
        id: `pending-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content,
        mode,
        meta: {},
        created_at: new Date().toISOString(),
      }
      setDetail({
        ...(baseDetail as ConversationDetail),
        messages: [...(baseDetail?.messages ?? []), optimistic],
      })

      await streamMessage(conversationId, content, mode, ({ event, data }) => {
        if (event === 'build') {
          const build = buildFrom(data.build)
          if (build) setCurrentBuild(build)
        }
        if (event === 'stage') {
          const stage = typeof data.stage === 'string' ? data.stage : ''
          const eventDetail = typeof data.detail === 'string' ? data.detail : ''
          if (stage) {
            setProgress((items) => {
              const next = items.filter((item) => item.stage !== stage)
              return [...next, { stage, detail: eventDetail }]
            })
          }
        }
        if (event === 'token' && typeof data.content === 'string') {
          setStreamingText((value) => value + data.content)
        }
        if (event === 'artifact' || event === 'build_error' || event === 'done') {
          const build = buildFrom(data.build)
          if (build) setCurrentBuild(build)
        }
      })

      const refreshed = await api.conversation(conversationId)
      setDetail(refreshed)
      setCurrentBuild(refreshed.builds[0] ?? null)
      setStreamingText('')
      await refreshConversations()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The factory request failed.'
      setToast(message)
      setStreamingText('')
      const failure: Message = {
        id: `error-${Date.now()}`,
        conversation_id: conversationId ?? '',
        role: 'assistant',
        content: `I couldn’t reach the factory: ${message}`,
        mode,
        meta: {},
        created_at: new Date().toISOString(),
      }
      setDetail((value) => value ? { ...value, messages: [...value.messages, failure] } : value)
    } finally {
      setBusy(false)
    }
  }

  const activityCount = useMemo(
    () => progress.filter((item) => item.stage !== 'completed').length,
    [progress],
  )

  return (
    <div className={`app-shell ${panelOpen ? 'panel-is-open' : ''}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        busy={busy}
        modelConnected={Boolean(health?.model_connected)}
        onClose={() => setSidebarOpen(false)}
        onNew={newConversation}
        onSelect={(id) => void selectConversation(id)}
        onDelete={(id) => void deleteConversation(id)}
      />

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setSidebarOpen(true)}>
            <Menu size={19} />
            <span className="sr-only">Open sidebar</span>
          </button>
          <button className="model-selector" type="button" title="Current factory">
            <span className="model-name">Hoolulu</span>
            <span className="model-edition">Factory</span>
            <ChevronDown size={14} />
          </button>
          {hasConversation && <span className="topbar-title">{activeTitle}</span>}
          <span className="topbar-spacer" />
          {(currentBuild || progress.length > 0) && (
            <button
              className={`activity-button ${panelOpen ? 'active' : ''}`}
              type="button"
              onClick={() => setPanelOpen((value) => !value)}
            >
              <Activity size={16} />
              <span>Activity</span>
              {busy && <i>{activityCount || 1}</i>}
            </button>
          )}
          <button className="core-badge" type="button" onClick={() => setShowCore(true)}>
            <LockKeyhole size={13} />
            <span>Core locked</span>
            <i />
          </button>
        </header>

        <main className="chat-area">
          {!hasConversation ? (
            <EmptyState
              value={draft}
              mode={mode}
              busy={busy}
              onChange={setDraft}
              onModeChange={setMode}
              onSubmit={() => void send()}
            />
          ) : (
            <div className="conversation-view">
              <MessageList
                messages={detail?.messages ?? []}
                builds={detail?.builds ?? (currentBuild ? [currentBuild] : [])}
                streamingText={streamingText}
                busy={busy}
              />
              <div className="conversation-composer">
                <Composer
                  value={draft}
                  mode={mode}
                  busy={busy}
                  compact
                  onChange={setDraft}
                  onModeChange={setMode}
                  onSubmit={() => void send()}
                />
                <p>Hoolulu can make mistakes. Review generated code before shipping.</p>
              </div>
            </div>
          )}
        </main>
      </section>

      <BuildPanel
        open={panelOpen}
        build={currentBuild}
        progress={progress}
        digest={core?.digest ?? ''}
        onClose={() => setPanelOpen(false)}
      />

      {showCore && <CoreModal core={core} onClose={() => setShowCore(false)} />}
      {toast && <div className="toast"><Sparkles size={15} /><span>{toast}</span></div>}
      <div className="mobile-brand"><BrandMark size="small" /></div>
    </div>
  )
}
