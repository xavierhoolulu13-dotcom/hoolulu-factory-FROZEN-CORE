import { useMemo, useState } from 'react'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Blocks,
  ChevronDown,
  Download,
  ExternalLink,
  LayoutGrid,
  Table2,
} from 'lucide-react'
import { formatDateTime, prettifyStage, shortPrompt } from '../lib/format'
import type { BuildRow } from '../types'
import { EmptyDatabase, StatusPill } from './ui'

type View = 'table' | 'gallery'
type SortKey = 'created_at' | 'updated_at' | 'status' | 'title'

const STATUS_FILTERS = ['all', 'completed', 'running', 'queued', 'failed'] as const

interface BuildsDbProps {
  builds: BuildRow[]
  loading: boolean
  onOpenBuild: (id: string) => void
  onOpenConversation: (id: string) => void
}

export function BuildsDb({ builds, loading, onOpenBuild, onOpenConversation }: BuildsDbProps) {
  const [view, setView] = useState<View>('table')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = builds.filter((build) => {
      if (statusFilter !== 'all' && build.status !== statusFilter) return false
      if (!needle) return true
      return (
        build.prompt.toLowerCase().includes(needle) ||
        (build.summary ?? '').toLowerCase().includes(needle) ||
        build.conversation_title.toLowerCase().includes(needle) ||
        build.id.toLowerCase().includes(needle)
      )
    })
    const key = (build: BuildRow): string => {
      if (sortKey === 'title') return shortPrompt(build.prompt).toLowerCase()
      return build[sortKey]
    }
    return filtered.sort((a, b) => {
      const result = key(a).localeCompare(key(b))
      return sortDir === 'asc' ? result : -result
    })
  }, [builds, query, statusFilter, sortKey, sortDir])

  const cycleSort = (next: SortKey) => {
    if (next === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(next)
      setSortDir('desc')
    }
  }

  const sortArrow = (key: SortKey) => {
    if (key !== sortKey) return null
    return sortDir === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />
  }

  const artifacts = (build: BuildRow) => (
    <span className="artifact-links">
      {build.download_url ? (
        <a href={build.download_url} title="Download ZIP" onClick={(e) => e.stopPropagation()}>
          <Download size={15} />
        </a>
      ) : (
        <span className="artifact-missing" title="Artifact not ready">—</span>
      )}
      {build.preview_url ? (
        <a href={build.preview_url} target="_blank" rel="noreferrer" title="Open live preview" onClick={(e) => e.stopPropagation()}>
          <ExternalLink size={15} />
        </a>
      ) : null}
    </span>
  )

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          <Blocks size={22} className="page-title-icon" /> Builds
        </h1>
        <p className="page-subtitle">
          {rows.length} of {builds.length} builds · every row links back to its conversation
        </p>
      </header>

      <div className="db-toolbar">
        <input
          className="db-search"
          type="search"
          placeholder="Search builds…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search builds"
        />
        <label className="db-filter">
          <span>Status</span>
          <span className="db-select-wrap">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </span>
        </label>
        <div className="view-toggle" role="group" aria-label="Database view">
          <button
            type="button"
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
            title="Table view"
          >
            <Table2 size={15} /> Table
          </button>
          <button
            type="button"
            className={view === 'gallery' ? 'active' : ''}
            onClick={() => setView('gallery')}
            title="Gallery view"
          >
            <LayoutGrid size={15} /> Gallery
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyDatabase
          icon={<Blocks size={28} />}
          title={loading ? 'Loading builds…' : 'No builds match'}
          hint={loading ? 'Fetching build history from the factory.' : 'Try clearing the search or choosing a different status.'}
        />
      ) : view === 'table' ? (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort" onClick={() => cycleSort('title')}>
                    Name {sortArrow('title')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => cycleSort('status')}>
                    Status {sortArrow('status')}
                  </button>
                </th>
                <th>Conversation</th>
                <th>Stage</th>
                <th>
                  <button type="button" className="th-sort" onClick={() => cycleSort('updated_at')}>
                    Updated {sortArrow('updated_at')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => cycleSort('created_at')}>
                    Created {sortArrow('created_at')}
                  </button>
                </th>
                <th>Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((build) => (
                <tr key={build.id} className="db-row" onClick={() => onOpenBuild(build.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenBuild(build.id) }}>
                  <td className="db-name">{shortPrompt(build.prompt, 60)}</td>
                  <td><StatusPill status={build.status} /></td>
                  <td>
                    <button
                      type="button"
                      className="db-link"
                      onClick={(e) => { e.stopPropagation(); onOpenConversation(build.conversation_id) }}
                    >
                      {build.conversation_title || 'Untitled'}
                    </button>
                  </td>
                  <td className="db-muted">{prettifyStage(build.stage)}</td>
                  <td className="db-muted" title={formatDateTime(build.updated_at)}>{formatDateTime(build.updated_at)}</td>
                  <td className="db-muted" title={formatDateTime(build.created_at)}>{formatDateTime(build.created_at)}</td>
                  <td>{artifacts(build)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gallery-grid">
          {rows.map((build) => (
            <button key={build.id} type="button" className="gallery-card" onClick={() => onOpenBuild(build.id)}>
              <span className="gallery-card-top">
                <StatusPill status={build.status} />
                {artifacts(build)}
              </span>
              <span className="gallery-card-title">{shortPrompt(build.prompt, 90)}</span>
              <span className="gallery-card-meta">
                {build.conversation_title || 'Untitled'} · {formatDateTime(build.created_at)}
              </span>
              {build.summary && <span className="gallery-card-summary">{shortPrompt(build.summary, 110)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
