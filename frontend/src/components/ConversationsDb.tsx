import { useMemo, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { formatDateTime, timeAgo } from '../lib/format'
import type { BuildRow, ConversationSummary } from '../types'
import { EmptyDatabase } from './ui'

interface ConversationsDbProps {
  conversations: ConversationSummary[]
  builds: BuildRow[]
  loading: boolean
  onOpenConversation: (id: string) => void
}

export function ConversationsDb({ conversations, builds, loading, onOpenConversation }: ConversationsDbProps) {
  const [query, setQuery] = useState('')

  const buildCounts = useMemo(() => {
    const counts = new Map<string, { total: number; completed: number }>()
    for (const build of builds) {
      const entry = counts.get(build.conversation_id) ?? { total: 0, completed: 0 }
      entry.total += 1
      if (build.status === 'completed') entry.completed += 1
      counts.set(build.conversation_id, entry)
    }
    return counts
  }, [builds])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => !needle || conversation.title.toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [conversations, query])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          <MessagesSquare size={22} className="page-title-icon" /> Conversations
        </h1>
        <p className="page-subtitle">
          {rows.length} conversations · click a row to see its messages and linked builds
        </p>
      </header>

      <div className="db-toolbar">
        <input
          className="db-search"
          type="search"
          placeholder="Search conversations…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search conversations"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyDatabase
          icon={<MessagesSquare size={28} />}
          title={loading ? 'Loading conversations…' : 'No conversations match'}
          hint={loading ? 'Fetching conversation history from the factory.' : 'Try a different search, or start a new build.'}
        />
      ) : (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Builds</th>
                <th>Last activity</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((conversation) => {
                const counts = buildCounts.get(conversation.id) ?? { total: 0, completed: 0 }
                return (
                  <tr
                    key={conversation.id}
                    className="db-row"
                    onClick={() => onOpenConversation(conversation.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onOpenConversation(conversation.id) }}
                  >
                    <td className="db-name">{conversation.title || 'Untitled'}</td>
                    <td>
                      <span className="count-badge">{counts.total}</span>
                      <span className="db-muted"> · {counts.completed} done</span>
                    </td>
                    <td className="db-muted" title={formatDateTime(conversation.updated_at)}>
                      {timeAgo(conversation.updated_at)}
                    </td>
                    <td className="db-muted" title={formatDateTime(conversation.created_at)}>
                      {formatDateTime(conversation.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
