import { Blocks, CheckCircle2, Hammer, MessagesSquare } from 'lucide-react'
import { shortPrompt, timeAgo } from '../lib/format'
import type { BuildRow, ConversationSummary } from '../types'
import { StatusPill } from './ui'

interface DashboardProps {
  builds: BuildRow[]
  conversations: ConversationSummary[]
  loading: boolean
  onOpenBuild: (id: string) => void
  onOpenConversation: (id: string) => void
}

export function Dashboard({ builds, conversations, loading, onOpenBuild, onOpenConversation }: DashboardProps) {
  const completed = builds.filter((b) => b.status === 'completed').length
  const failed = builds.filter((b) => b.status === 'failed').length
  const active = builds.filter((b) => b.status === 'running' || b.status === 'queued').length

  const stats = [
    { icon: <Blocks size={18} />, value: String(builds.length), label: 'Total builds', tone: 'stat-blue' },
    { icon: <CheckCircle2 size={18} />, value: String(completed), label: 'Completed', tone: 'stat-green' },
    { icon: <Hammer size={18} />, value: String(active), label: 'Running / queued', tone: 'stat-amber' },
    { icon: <MessagesSquare size={18} />, value: String(conversations.length), label: 'Conversations', tone: 'stat-purple' },
  ]

  const recentBuilds = [...builds]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
  const recentConversations = [...conversations]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5)

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">A live view of everything the factory has built.</p>
      </header>

      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <span className={`stat-icon ${stat.tone}`}>{stat.icon}</span>
            <div>
              <p className="stat-value">{loading ? '—' : stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="dash-panel">
          <h2 className="dash-panel-title">Recent builds</h2>
          {recentBuilds.length === 0 ? (
            <p className="dash-empty">{loading ? 'Loading…' : 'No builds yet. Kick off your first from New build.'}</p>
          ) : (
            <ul className="dash-list">
              {recentBuilds.map((build) => (
                <li key={build.id}>
                  <button type="button" className="dash-row" onClick={() => onOpenBuild(build.id)}>
                    <span className="dash-row-main">
                      <StatusPill status={build.status} />
                      <span className="dash-row-title">{shortPrompt(build.prompt)}</span>
                    </span>
                    <span className="dash-row-meta">{timeAgo(build.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel">
          <h2 className="dash-panel-title">Recent conversations</h2>
          {recentConversations.length === 0 ? (
            <p className="dash-empty">{loading ? 'Loading…' : 'No conversations yet.'}</p>
          ) : (
            <ul className="dash-list">
              {recentConversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className="dash-row"
                    onClick={() => onOpenConversation(conversation.id)}
                  >
                    <span className="dash-row-main">
                      <MessagesSquare size={15} className="dash-row-icon" />
                      <span className="dash-row-title">{conversation.title || 'Untitled'}</span>
                    </span>
                    <span className="dash-row-meta">{timeAgo(conversation.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {failed > 0 && (
            <p className="dash-note">{failed} build{failed === 1 ? '' : 's'} failed — open the Builds database to review.</p>
          )}
        </section>
      </div>
    </div>
  )
}
