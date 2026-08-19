import {
  Cpu,
  MessageSquareText,
  PanelLeftClose,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ConversationSummary } from '../types'
import { BrandMark } from './BrandMark'

interface SidebarProps {
  conversations: ConversationSummary[]
  activeId: string | null
  open: boolean
  busy: boolean
  modelConnected: boolean
  onClose: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function isToday(date: string): boolean {
  const value = new Date(date)
  const now = new Date()
  return value.toDateString() === now.toDateString()
}

export function Sidebar({
  conversations,
  activeId,
  open,
  busy,
  modelConnected,
  onClose,
  onNew,
  onSelect,
  onDelete,
}: SidebarProps) {
  const today = conversations.filter((item) => isToday(item.updated_at))
  const earlier = conversations.filter((item) => !isToday(item.updated_at))

  const section = (label: string, items: ConversationSummary[]) =>
    items.length > 0 && (
      <section className="history-section" key={label}>
        <p className="history-label">{label}</p>
        <div className="history-list">
          {items.map((conversation) => (
            <div
              className={`history-row ${activeId === conversation.id ? 'active' : ''}`}
              key={conversation.id}
            >
              <button
                className="history-select"
                type="button"
                disabled={busy}
                onClick={() => {
                  onSelect(conversation.id)
                  onClose()
                }}
              >
                <MessageSquareText size={15} strokeWidth={1.8} />
                <span>{conversation.title}</span>
              </button>
              <button
                className="history-delete"
                type="button"
                aria-label={`Delete ${conversation.title}`}
                disabled={busy}
                onClick={() => onDelete(conversation.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    )

  return (
    <>
      <button
        type="button"
        className={`sidebar-scrim ${open ? 'visible' : ''}`}
        aria-label="Close sidebar"
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-heading">
          <a className="sidebar-brand" href="/" onClick={(event) => event.preventDefault()}>
            <BrandMark size="small" />
            <span>hoolulu</span>
          </a>
          <button className="icon-button sidebar-close" type="button" onClick={onClose}>
            <PanelLeftClose size={18} />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>

        <button className="new-build-button" type="button" disabled={busy} onClick={onNew}>
          <Plus size={17} />
          <span>New build</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="history-scroll">
          {conversations.length === 0 ? (
            <div className="history-empty">
              <MessageSquareText size={18} />
              <p>Your builds will live here.</p>
            </div>
          ) : (
            <>
              {section('Today', today)}
              {section('Earlier', earlier)}
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="runtime-row">
            <span className="runtime-icon"><Cpu size={15} /></span>
            <span>
              <strong>{modelConnected ? 'Model connected' : 'Local factory'}</strong>
              <small>{modelConnected ? 'Custom generation on' : 'Ready · no key needed'}</small>
            </span>
            <i className="online-dot" />
          </div>
          <p className="sidebar-version">Hoolulu Factory · v0.1</p>
        </div>
      </aside>
    </>
  )
}
