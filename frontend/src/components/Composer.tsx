import { useEffect, useRef } from 'react'
import { ArrowUp, Hammer, LoaderCircle, MessageCircle, Plus } from 'lucide-react'
import type { Mode } from '../types'

interface ComposerProps {
  value: string
  mode: Mode
  busy: boolean
  compact?: boolean
  onChange: (value: string) => void
  onModeChange: (mode: Mode) => void
  onSubmit: () => void
}

export function Composer({
  value,
  mode,
  busy,
  compact = false,
  onChange,
  onModeChange,
  onSubmit,
}: ComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }, [value])

  return (
    <form
      className={`composer ${compact ? 'composer-compact' : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim() && !busy) onSubmit()
      }}
    >
      <textarea
        ref={textarea}
        value={value}
        disabled={busy}
        rows={1}
        maxLength={12000}
        aria-label="Message Hoolulu Factory"
        placeholder={mode === 'build' ? 'Describe what you want to build…' : 'Ask Hoolulu anything…'}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (value.trim() && !busy) onSubmit()
          }
        }}
      />
      <div className="composer-toolbar">
        <button
          className="composer-tool muted-tool"
          type="button"
          disabled
          title="Attachments are coming soon"
          aria-label="Attach a file (coming soon)"
        >
          <Plus size={18} />
        </button>
        <div className="mode-switch" aria-label="Response mode">
          <button
            type="button"
            className={mode === 'build' ? 'selected' : ''}
            disabled={busy}
            onClick={() => onModeChange('build')}
          >
            <Hammer size={14} /> Build
          </button>
          <button
            type="button"
            className={mode === 'chat' ? 'selected' : ''}
            disabled={busy}
            onClick={() => onModeChange('chat')}
          >
            <MessageCircle size={14} /> Chat
          </button>
        </div>
        <span className="composer-spacer" />
        <span className="enter-hint">↵</span>
        <button
          className="send-button"
          type="submit"
          disabled={!value.trim() || busy}
          aria-label={busy ? 'Factory is working' : 'Send message'}
        >
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} strokeWidth={2.4} />}
        </button>
      </div>
    </form>
  )
}
