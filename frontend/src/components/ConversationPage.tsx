import { MessagesSquare, Trash2 } from 'lucide-react'
import { formatDateTime } from '../lib/format'
import type { Build, BuildRow, ConversationDetail } from '../types'
import { MessageList } from './MessageList'
import { BacklinkSection, BuildLinkCard, PropertyRow } from './ui'

interface ConversationPageProps {
  detail: ConversationDetail
  busy: boolean
  onDelete: (id: string) => void
  onOpenBuild: (id: string) => void
  onBack: () => void
}

export function ConversationPage({ detail, busy, onDelete, onOpenBuild, onBack }: ConversationPageProps) {
  const builds: BuildRow[] = detail.builds.map((build: Build) => ({
    ...build,
    conversation_title: detail.title,
  }))

  return (
    <div className="page detail-page">
      <button type="button" className="breadcrumb" onClick={onBack}>
        ← All conversations
      </button>

      <header className="page-header page-header-split">
        <div>
          <h1 className="page-title">
            <MessagesSquare size={22} className="page-title-icon" />
            {detail.title || 'Untitled conversation'}
          </h1>
          <p className="page-subtitle">
            {detail.messages.length} message{detail.messages.length === 1 ? '' : 's'} ·{' '}
            {builds.length} linked build{builds.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={() => onDelete(detail.id)}
          title="Delete this conversation and its artifacts"
        >
          <Trash2 size={15} /> Delete
        </button>
      </header>

      <div className="detail-grid">
        <section className="detail-main">
          <div className="property-card">
            <PropertyRow label="Created">
              <span className="db-muted">{formatDateTime(detail.created_at)}</span>
            </PropertyRow>
            <PropertyRow label="Last activity">
              <span className="db-muted">{formatDateTime(detail.updated_at)}</span>
            </PropertyRow>
          </div>

          {detail.messages.length > 0 && (
            <div className="message-panel">
              <MessageList
                messages={detail.messages}
                builds={detail.builds}
                streamingText=""
                busy={busy}
              />
            </div>
          )}
        </section>

        <aside className="detail-side">
          <BacklinkSection title={`Linked builds (${builds.length})`}>
            {builds.length === 0 ? (
              <p className="backlink-empty">No builds in this conversation yet.</p>
            ) : (
              builds.map((build) => (
                <BuildLinkCard key={build.id} build={build} onOpen={() => onOpenBuild(build.id)} />
              ))
            )}
          </BacklinkSection>
        </aside>
      </div>
    </div>
  )
}
