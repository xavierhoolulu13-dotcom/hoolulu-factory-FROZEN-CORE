import { Check, ChevronRight, Circle, LoaderCircle, LockKeyhole, X } from 'lucide-react'
import type { Build, ProgressItem } from '../types'
import { ArtifactCard } from './ArtifactCard'

interface BuildPanelProps {
  open: boolean
  build: Build | null
  progress: ProgressItem[]
  digest: string
  onClose: () => void
}

const pipeline = ['understand', 'plan', 'generate', 'validate', 'package']
const labels: Record<string, string> = {
  understand: 'Understand request',
  plan: 'Plan experience',
  generate: 'Generate files',
  validate: 'Validate output',
  package: 'Package artifact',
}

export function BuildPanel({ open, build, progress, digest, onClose }: BuildPanelProps) {
  const latestStage = progress.at(-1)?.stage ?? build?.stage ?? ''
  const activeIndex = pipeline.indexOf(latestStage)
  const finished = build?.status === 'completed'
  const failed = build?.status === 'failed'

  return (
    <aside className={`build-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="build-panel-header">
        <div>
          <span className="panel-kicker">Factory activity</span>
          <h2>{finished ? 'Build complete' : failed ? 'Build stopped' : 'Assembling project'}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close activity">
          <X size={18} />
        </button>
      </div>

      <div className="core-strip">
        <span><LockKeyhole size={15} /></span>
        <div><strong>Frozen Core enforced</strong><small>{digest ? digest.slice(0, 12) : 'verifying'}…</small></div>
      </div>

      <div className="pipeline-list">
        {pipeline.map((stage, index) => {
          const event = [...progress].reverse().find((item) => item.stage === stage)
          const done = finished || index < activeIndex
          const active = !finished && !failed && index === activeIndex
          return (
            <div className={`pipeline-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={stage}>
              <span className="step-status">
                {done ? <Check size={13} /> : active ? <LoaderCircle className="spin" size={14} /> : <Circle size={11} />}
              </span>
              <div><strong>{labels[stage]}</strong><small>{event?.detail ?? (done ? 'Complete' : 'Waiting')}</small></div>
              {active && <ChevronRight size={15} />}
            </div>
          )
        })}
      </div>

      <div className="build-panel-spacer" />
      {build && <ArtifactCard build={build} dense />}
      <p className="panel-note">Generated code is validated and packaged, never executed on the host.</p>
    </aside>
  )
}
