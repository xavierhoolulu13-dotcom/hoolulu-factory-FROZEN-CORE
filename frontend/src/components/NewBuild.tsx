import { useState } from 'react'
import { Download, ExternalLink, Hammer, LoaderCircle } from 'lucide-react'
import { api, streamMessage } from '../lib/api'
import { prettifyStage } from '../lib/format'
import type { Build, ProgressItem } from '../types'
import { Composer } from './Composer'
import { StatusPill } from './ui'

interface NewBuildProps {
  initialPrompt?: string
  onCreated: (buildId: string, conversationId: string) => void
  onOpenBuild: (id: string) => void
}

function buildFrom(value: unknown): Build | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null
  return value as Build
}

export function NewBuild({ initialPrompt, onCreated, onOpenBuild }: NewBuildProps) {
  const [draft, setDraft] = useState(initialPrompt ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [finalBuild, setFinalBuild] = useState<Build | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const send = async () => {
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    setError(null)
    setDraft('')
    setStreamingText('')
    setProgress([])
    setFinalBuild(null)
    setConversationId(null)

    try {
      const conversation = await api.createConversation()
      setConversationId(conversation.id)

      await streamMessage(conversation.id, content, 'build', ({ event, data }) => {
        if (event === 'build') {
          const build = buildFrom(data.build)
          if (build) onCreated(build.id, conversation.id)
        }
        if (event === 'stage') {
          const stage = typeof data.stage === 'string' ? data.stage : ''
          const detail = typeof data.detail === 'string' ? data.detail : ''
          if (stage) {
            setProgress((items) => {
              const next = items.filter((item) => item.stage !== stage)
              return [...next, { stage, detail }]
            })
          }
        }
        if (event === 'token' && typeof data.content === 'string') {
          setStreamingText((value) => value + data.content)
        }
        if (event === 'artifact' || event === 'build_error' || event === 'done') {
          const build = buildFrom(data.build)
          if (build) setFinalBuild(build)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The factory request failed.')
    } finally {
      setBusy(false)
    }
  }

  const finished = !busy && (finalBuild !== null || error !== null)

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          <Hammer size={22} className="page-title-icon" /> New build
        </h1>
        <p className="page-subtitle">
          Describe the project. The factory compiles it through the Frozen Core and returns a ZIP.
        </p>
      </header>

      <div className="new-build-card">
        <Composer value={draft} mode="build" busy={busy} onChange={setDraft} onModeChange={() => {}} onSubmit={send} />
      </div>

      {busy && (
        <section className="build-progress">
          <h2 className="build-progress-title">
            <LoaderCircle size={16} className="spin" /> Factory is working…
          </h2>
          <ul className="progress-list">
            {progress.map((item) => (
              <li key={item.stage}>
                <span className="progress-stage">{prettifyStage(item.stage)}</span>
                <span className="progress-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
          {streamingText && <p className="streaming-note">{streamingText}</p>}
        </section>
      )}

      {finished && finalBuild && (
        <section className="build-result">
          <div className="result-header">
            <StatusPill status={finalBuild.status} />
            <span className="result-id">{finalBuild.id}</span>
          </div>
          {finalBuild.summary && <p className="result-summary">{finalBuild.summary}</p>}
          {finalBuild.error && <p className="error-text">{finalBuild.error}</p>}
          {streamingText && <p className="result-notes">{streamingText}</p>}
          <div className="action-card">
            {finalBuild.download_url && (
              <a className="action-button primary" href={finalBuild.download_url}>
                <Download size={16} /> Download ZIP
              </a>
            )}
            {finalBuild.preview_url && (
              <a className="action-button" href={finalBuild.preview_url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Live preview
              </a>
            )}
            <button type="button" className="action-button" onClick={() => onOpenBuild(finalBuild.id)}>
              Open build page
            </button>
          </div>
        </section>
      )}

      {finished && error && (
        <section className="build-result">
          <p className="error-text">I couldn’t reach the factory: {error}</p>
        </section>
      )}

      {!busy && !finished && conversationId === null && (
        <p className="new-build-hint">
          Tip: ask for a landing page, a portfolio site, or a small business page. Static web builds work best.
        </p>
      )}
    </div>
  )
}
