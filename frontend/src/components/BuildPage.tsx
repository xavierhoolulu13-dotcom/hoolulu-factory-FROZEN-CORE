import { useEffect, useState } from 'react'
import { AlertTriangle, Download, ExternalLink, MessagesSquare, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime, prettifyStage, shortPrompt } from '../lib/format'
import type { Build } from '../types'
import { BacklinkSection, PropertyRow, StatusPill } from './ui'

interface BuildPageProps {
  buildId: string
  initialBuild: Build | null
  conversationTitle: string | null
  onOpenConversation: (id: string) => void
  onBack: () => void
}

const POLL_MS = 4000

export function BuildPage({ buildId, initialBuild, conversationTitle, onOpenConversation, onBack }: BuildPageProps) {
  const [build, setBuild] = useState<Build | null>(initialBuild)
  const [loading, setLoading] = useState(!initialBuild)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(!initialBuild)
    setLoadError(null)
    void api
      .build(buildId)
      .then((value) => {
        if (!cancelled) {
          setBuild(value)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoadError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [buildId])

  // Live-poll while the build is still working so the page reflects reality.
  useEffect(() => {
    if (!build || build.status === 'completed' || build.status === 'failed') return
    const timer = window.setInterval(() => {
      void api
        .build(buildId)
        .then(setBuild)
        .catch(() => {
          /* keep the last known state */
        })
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [buildId, build?.status])

  const manualRefresh = async () => {
    setRefreshing(true)
    try {
      setBuild(await api.build(buildId))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not refresh the build.')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="page detail-page">
        <p className="dash-empty">Loading build…</p>
      </div>
    )
  }

  if (!build) {
    return (
      <div className="page detail-page">
        <button type="button" className="breadcrumb" onClick={onBack}>
          ← All builds
        </button>
        <p className="error-text">{loadError ?? 'Build not found.'}</p>
      </div>
    )
  }

  return (
    <div className="page detail-page">
      <button type="button" className="breadcrumb" onClick={onBack}>
        ← All builds
      </button>

      <header className="page-header page-header-split">
        <div>
          <h1 className="page-title">{shortPrompt(build.prompt, 90)}</h1>
          <p className="page-subtitle">Build · {build.id}</p>
        </div>
        <button type="button" className="ghost-button" onClick={manualRefresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </header>

      <div className="detail-grid">
        <section className="detail-main">
          <div className="property-card">
            <PropertyRow label="Status">
              <StatusPill status={build.status} />
            </PropertyRow>
            <PropertyRow label="Stage">
              <span className="db-muted">{prettifyStage(build.stage)}</span>
            </PropertyRow>
            <PropertyRow label="Prompt">
              <span className="property-long">{build.prompt}</span>
            </PropertyRow>
            {build.summary && (
              <PropertyRow label="Summary">
                <span className="property-long">{build.summary}</span>
              </PropertyRow>
            )}
            {build.error && (
              <PropertyRow label="Error">
                <span className="error-text">
                  <AlertTriangle size={14} /> {build.error}
                </span>
              </PropertyRow>
            )}
            <PropertyRow label="Created">
              <span className="db-muted">{formatDateTime(build.created_at)}</span>
            </PropertyRow>
            <PropertyRow label="Updated">
              <span className="db-muted">{formatDateTime(build.updated_at)}</span>
            </PropertyRow>
          </div>

          {build.status === 'completed' && (
            <div className="action-card">
              <a className="action-button primary" href={build.download_url ?? '#'} title="Download the build ZIP">
                <Download size={16} /> Download ZIP
              </a>
              {build.preview_url && (
                <a className="action-button" href={build.preview_url} target="_blank" rel="noreferrer" title="Open the live preview">
                  <ExternalLink size={16} /> Live preview
                </a>
              )}
            </div>
          )}
        </section>

        <aside className="detail-side">
          <BacklinkSection title="Linked from">
            <button
              type="button"
              className="backlink-card"
              onClick={() => onOpenConversation(build.conversation_id)}
            >
              <span className="backlink-card-title">
                <MessagesSquare size={14} />
                {conversationTitle || 'Conversation'}
              </span>
              <span className="backlink-card-meta">Parent conversation · click to open</span>
            </button>
          </BacklinkSection>
        </aside>
      </div>
    </div>
  )
}
