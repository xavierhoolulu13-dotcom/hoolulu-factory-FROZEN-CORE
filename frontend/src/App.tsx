import { useCallback, useEffect, useState } from 'react'
import { Menu, Sparkles } from 'lucide-react'
import { api } from './lib/api'
import type {
  Build,
  BuildRow,
  ConversationDetail,
  ConversationSummary,
  CoreResponse,
  HealthResponse,
} from './types'
import { BrandMark } from './components/BrandMark'
import { BuildPage } from './components/BuildPage'
import { BuildsDb } from './components/BuildsDb'
import { ConversationPage } from './components/ConversationPage'
import { ConversationsDb } from './components/ConversationsDb'
import { CoreModal } from './components/CoreModal'
import { Dashboard } from './components/Dashboard'
import { NewBuild } from './components/NewBuild'
import { Sidebar, type Page } from './components/Sidebar'
import './styles.css'

type Route =
  | { page: 'dashboard' }
  | { page: 'builds' }
  | { page: 'conversations' }
  | { page: 'new' }
  | { page: 'build'; id: string }
  | { page: 'conversation'; id: string }

function navPage(route: Route): Page {
  return route.page === 'build' ? 'builds' : route.page === 'conversation' ? 'conversations' : route.page
}

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'dashboard' })
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [builds, setBuilds] = useState<BuildRow[]>([])
  const [details, setDetails] = useState<Record<string, ConversationDetail>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [core, setCore] = useState<CoreResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [showCore, setShowCore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => setToast(message), [])

  const refreshAll = useCallback(async () => {
    try {
      const items = await api.conversations()
      setConversations(items)
      const fetched = await Promise.all(
        items.map((item) => api.conversation(item.id).catch(() => null)),
      )
      const rows: BuildRow[] = []
      const cache: Record<string, ConversationDetail> = {}
      for (const detail of fetched) {
        if (!detail) continue
        cache[detail.id] = detail
        for (const build of detail.builds) {
          rows.push({ ...build, conversation_title: detail.title })
        }
      }
      setDetails(cache)
      setBuilds(rows)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not load factory data.')
    } finally {
      setLoading(false)
    }
  }, [flash])

  useEffect(() => {
    void refreshAll()
    void api.core().then(setCore).catch(() => flash('Frozen Core verification failed.'))
    void api.health().then(setHealth).catch(() => flash('Factory backend is offline.'))
  }, [refreshAll, flash])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        setShowCore(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigate = (page: Page) => {
    setRoute({ page })
    setSidebarOpen(false)
  }

  const openBuild = useCallback(
    async (id: string) => {
      setRoute({ page: 'build', id })
      setSidebarOpen(false)
      // Make sure the builds index knows about this build (e.g. just created).
      if (!builds.some((build) => build.id === id)) {
        await refreshAll()
      }
    },
    [builds, refreshAll],
  )

  const openConversation = useCallback(
    async (id: string) => {
      setRoute({ page: 'conversation', id })
      setSidebarOpen(false)
      if (!details[id]) {
        try {
          const detail = await api.conversation(id)
          setDetails((cache) => ({ ...cache, [id]: detail }))
        } catch (error) {
          flash(error instanceof Error ? error.message : 'Could not open that conversation.')
        }
      }
    },
    [details, flash],
  )

  const deleteConversation = async (id: string) => {
    const item = conversations.find((conversation) => conversation.id === id)
    if (!window.confirm(`Delete “${item?.title || 'this conversation'}” and its artifacts?`)) return
    setBusy(true)
    try {
      await api.deleteConversation(id)
      setDetails((cache) => {
        const next = { ...cache }
        delete next[id]
        return next
      })
      await refreshAll()
      setRoute({ page: 'conversations' })
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not delete that conversation.')
    } finally {
      setBusy(false)
    }
  }

  const initialBuildFor = (id: string): Build | null => {
    const row = builds.find((build) => build.id === id)
    if (!row) return null
    const { conversation_title: _title, ...build } = row
    return build as Build
  }

  const conversationTitleFor = (buildId: string): string | null => {
    const row = builds.find((build) => build.id === buildId)
    return row?.conversation_title ?? null
  }

  const page = navPage(route)
  const activeConversationId = route.page === 'conversation' ? route.id : null

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        conversations={conversations}
        activeConversationId={activeConversationId}
        open={sidebarOpen}
        modelConnected={Boolean(health?.model_connected)}
        onNavigate={navigate}
        onOpenConversation={(id) => void openConversation(id)}
        onClose={() => setSidebarOpen(false)}
        onShowCore={() => setShowCore(true)}
      />

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setSidebarOpen(true)}>
            <Menu size={19} />
            <span className="sr-only">Open sidebar</span>
          </button>
          <span className="topbar-title">
            {route.page === 'build'
              ? 'Build'
              : route.page === 'conversation'
                ? 'Conversation'
                : route.page === 'new'
                  ? 'New build'
                  : page[0].toUpperCase() + page.slice(1)}
          </span>
          <span className="topbar-spacer" />
          {health && (
            <span className={`health-chip ${health.status === 'ok' ? 'ok' : 'down'}`} title={health.service}>
              {health.status === 'ok' ? 'Factory online' : 'Factory offline'}
            </span>
          )}
        </header>

        <main className="page-scroll">
          {route.page === 'dashboard' && (
            <Dashboard
              builds={builds}
              conversations={conversations}
              loading={loading}
              onOpenBuild={(id) => void openBuild(id)}
              onOpenConversation={(id) => void openConversation(id)}
            />
          )}
          {route.page === 'builds' && (
            <BuildsDb
              builds={builds}
              loading={loading}
              onOpenBuild={(id) => void openBuild(id)}
              onOpenConversation={(id) => void openConversation(id)}
            />
          )}
          {route.page === 'conversations' && (
            <ConversationsDb
              conversations={conversations}
              builds={builds}
              loading={loading}
              onOpenConversation={(id) => void openConversation(id)}
            />
          )}
          {route.page === 'new' && (
            <NewBuild
              onCreated={() => void refreshAll()}
              onOpenBuild={(id) => void openBuild(id)}
            />
          )}
          {route.page === 'build' && (
            <BuildPage
              key={route.id}
              buildId={route.id}
              initialBuild={initialBuildFor(route.id)}
              conversationTitle={conversationTitleFor(route.id)}
              onOpenConversation={(id) => void openConversation(id)}
              onBack={() => setRoute({ page: 'builds' })}
            />
          )}
          {route.page === 'conversation' && details[route.id] && (
            <ConversationPage
              key={route.id}
              detail={details[route.id]}
              busy={busy}
              onDelete={(id) => void deleteConversation(id)}
              onOpenBuild={(id) => void openBuild(id)}
              onBack={() => setRoute({ page: 'conversations' })}
            />
          )}
          {route.page === 'conversation' && !details[route.id] && (
            <div className="page">
              <p className="dash-empty">Loading conversation…</p>
            </div>
          )}
        </main>
      </section>

      {showCore && <CoreModal core={core} onClose={() => setShowCore(false)} />}
      {toast && (
        <div className="toast">
          <Sparkles size={15} />
          <span>{toast}</span>
        </div>
      )}
      <div className="mobile-brand">
        <BrandMark size="small" />
      </div>
    </div>
  )
}
