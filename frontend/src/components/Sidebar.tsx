import {
  Blocks,
  CirclePlus,
  Fingerprint,
  LayoutDashboard,
  MessagesSquare,
  ScanSearch,
} from 'lucide-react'
import { BrandMark } from './BrandMark'
import type { ConversationSummary } from '../types'

export type Page = 'dashboard' | 'builds' | 'conversations' | 'new' | 'audit'

interface SidebarProps {
  page: Page
  conversations: ConversationSummary[]
  activeConversationId: string | null
  open: boolean
  modelConnected: boolean
  onNavigate: (page: Page) => void
  onOpenConversation: (id: string) => void
  onClose: () => void
  onShowCore: () => void
}

const NAV: Array<{ id: Page; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
  { id: 'audit', label: 'AI Visibility Audit', icon: <ScanSearch size={17} /> },
  { id: 'builds', label: 'Builds', icon: <Blocks size={17} /> },
  { id: 'conversations', label: 'Conversations', icon: <MessagesSquare size={17} /> },
]

export function Sidebar({
  page,
  conversations,
  activeConversationId,
  open,
  modelConnected,
  onNavigate,
  onOpenConversation,
  onClose,
  onShowCore,
}: SidebarProps) {
  return (
    <aside className={`notion-sidebar ${open ? 'open' : ''}`}>
      <button className="sidebar-scrim" type="button" aria-label="Close sidebar" onClick={onClose} />
      <div className="sidebar-inner">
        <div className="sidebar-brand">
          <BrandMark size="small" />
          <div>
            <p className="sidebar-brand-name">Hoolulu Factory</p>
            <p className="sidebar-brand-sub">Notion-style dashboard</p>
          </div>
        </div>

        <button className="new-build-button" type="button" onClick={() => onNavigate('new')}>
          <CirclePlus size={17} />
          New build
        </button>

        <nav className="sidebar-nav" aria-label="Pages">
          <p className="sidebar-section-label">Pages</p>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {conversations.length > 0 && (
          <div className="sidebar-recents">
            <p className="sidebar-section-label">Recent conversations</p>
            <ul>
              {conversations.slice(0, 8).map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={`sidebar-recent-item ${activeConversationId === conversation.id ? 'active' : ''}`}
                    onClick={() => onOpenConversation(conversation.id)}
                    title={conversation.title}
                  >
                    <MessagesSquare size={14} />
                    <span>{conversation.title || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sidebar-footer">
          <button className="core-badge" type="button" onClick={onShowCore}>
            <Fingerprint size={13} />
            <span>Core locked</span>
            <i className={`model-dot ${modelConnected ? 'on' : 'off'}`} title={modelConnected ? 'Model connected' : 'Model offline'} />
          </button>
        </div>
      </div>
    </aside>
  )
}
