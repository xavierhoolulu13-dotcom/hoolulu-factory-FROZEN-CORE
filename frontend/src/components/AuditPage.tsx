import { CheckCircle2, Eye, Hammer, Mail, SearchCheck, Wallet } from 'lucide-react'
import { PropertyRow } from './ui'

interface AuditPageProps {
  onBuildClient: () => void
}

const STEPS = [
  {
    n: '01',
    title: 'We ask the AIs',
    text: 'We ask ChatGPT, Perplexity, and Google AI about your business — versus 3 of your competitors.',
  },
  {
    n: '02',
    title: 'You see where you’re invisible',
    text: 'You get a report showing exactly where customers can’t find you — and where competitors win.',
  },
  {
    n: '03',
    title: 'We fix the gaps',
    text: 'We close the visibility gaps so the AIs recommend you first.',
  },
]

const DELIVERABLES = [
  {
    icon: <Eye size={18} />,
    title: 'Visibility report',
    text: 'How the major AIs answer about your business today — the good, the bad, the invisible.',
  },
  {
    icon: <SearchCheck size={18} />,
    title: 'Competitor comparison',
    text: 'Side-by-side against 3 competitors: who shows up, who doesn’t, and why.',
  },
  {
    icon: <CheckCircle2 size={18} />,
    title: 'Fix checklist',
    text: 'A prioritized list of exactly what to fix, in order — no guesswork.',
  },
]

export function AuditPage({ onBuildClient }: AuditPageProps) {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">AI Visibility Audit</h1>
        <p className="page-subtitle">The XKSH808 offer — sell it to Honolulu businesses.</p>
      </header>

      <section className="dash-panel">
        <p className="dash-panel-title">The pitch</p>
        <p className="audit-hero">Get found where customers actually ask: ChatGPT, Perplexity, Google AI.</p>
        <p className="dash-note">
          Google is dying as a traffic source. Customers now ask AIs who to hire — and most local
          businesses are invisible there. We find the gaps and fix them.
        </p>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel-title">How it works</h2>
        <div className="gallery-grid">
          {STEPS.map((step) => (
            <article key={step.n} className="gallery-card">
              <p className="gallery-card-top">{step.n}</p>
              <h3 className="gallery-card-title">{step.title}</h3>
              <p className="gallery-card-summary">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel-title">What you get</h2>
        <div className="gallery-grid">
          {DELIVERABLES.map((item) => (
            <article key={item.title} className="gallery-card">
              <p className="gallery-card-top">{item.icon}</p>
              <h3 className="gallery-card-title">{item.title}</h3>
              <p className="gallery-card-summary">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel-title">Pricing</h2>
        <p className="audit-hero">DM “VISIBLE” for a free check.</p>
        <p className="dash-note">Free visibility check first. Paid audit + fixes after they see the gaps.</p>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel-title">Contact</h2>
        <div className="detail-grid">
          <PropertyRow label="Email">
            <span className="db-link">
              <Mail size={14} /> xavierhoolulu13@gmail.com
            </span>
          </PropertyRow>
          <PropertyRow label="Cash App">
            <span className="db-link">
              <Wallet size={14} /> $xksh808dsh
            </span>
          </PropertyRow>
        </div>
      </section>

      <div className="action-card">
        <button type="button" className="action-button primary" onClick={onBuildClient}>
          <Hammer size={16} /> Build client version
        </button>
        <p className="dash-note">Opens New build with the audit landing page prompt prefilled — tweak and ship.</p>
      </div>
    </div>
  )
}
