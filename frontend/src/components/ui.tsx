import { Link2, SearchX } from 'lucide-react'
import { prettifyStage, shortPrompt, statusLabel } from '../lib/format'
import type { BuildRow } from '../types'

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${status}`} title={prettifyStage(status)}>
      <i className="status-dot" />
      {statusLabel(status)}
    </span>
  )
}

export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className="property-value">{children}</span>
    </div>
  )
}

export function BacklinkSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="backlink-section">
      <h3 className="backlink-heading">
        <Link2 size={14} />
        {title}
      </h3>
      <div className="backlink-list">{children}</div>
    </section>
  )
}

export function BuildLinkCard({ build, onOpen }: { build: BuildRow; onOpen: () => void }) {
  return (
    <button className="backlink-card" type="button" onClick={onOpen}>
      <span className="backlink-card-title">{build.summary || shortPrompt(build.prompt, 80)}</span>
      <span className="backlink-card-meta">
        <StatusPill status={build.status} />
      </span>
    </button>
  )
}

export function EmptyDatabase({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="empty-database">
      <div className="empty-database-icon">{icon ?? <SearchX size={28} />}</div>
      <p className="empty-database-title">{title}</p>
      <p className="empty-database-hint">{hint}</p>
    </div>
  )
}
