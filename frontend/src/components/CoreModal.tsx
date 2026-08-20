import { Check, Fingerprint, LockKeyhole, X } from 'lucide-react'
import type { CoreResponse } from '../types'

interface CoreModalProps {
  core: CoreResponse | null
  onClose: () => void
}

export function CoreModal({ core, onClose }: CoreModalProps) {
  if (!core) return null
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section className="core-modal" role="dialog" aria-modal="true" aria-labelledby="core-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="modal-lock"><LockKeyhole size={25} /></div>
        <p className="panel-kicker">Immutable contract</p>
        <h2 id="core-title">Frozen Core <span>v{core.document.version}</span></h2>
        <p className="modal-purpose">{core.document.purpose}</p>
        <div className="digest-box">
          <Fingerprint size={18} />
          <span><small>SHA-256 integrity digest</small><code>{core.digest}</code></span>
        </div>
        <div className="principle-list">
          {core.document.principles.map((principle) => (
            <div key={principle.id}><span><Check size={12} /></span><p>{principle.rule}</p></div>
          ))}
        </div>
        <p className="read-only-note">This API exposes the Core through GET only. Runtime mutation is intentionally impossible.</p>
      </section>
    </div>
  )
}
