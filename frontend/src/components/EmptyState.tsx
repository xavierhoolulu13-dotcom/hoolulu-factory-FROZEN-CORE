import { ArrowUpRight, BarChart3, PanelsTopLeft, ShoppingBag, Sparkles } from 'lucide-react'
import { Composer } from './Composer'
import type { Mode } from '../types'
import { BrandMark } from './BrandMark'

interface EmptyStateProps {
  value: string
  mode: Mode
  busy: boolean
  onChange: (value: string) => void
  onModeChange: (mode: Mode) => void
  onSubmit: () => void
}

const starters = [
  {
    icon: ShoppingBag,
    title: 'Modern storefront',
    detail: 'A refined shop for an island coffee brand',
    prompt: 'Build a modern storefront for an island coffee brand with featured roasts, a subscription section, and a warm editorial style.',
  },
  {
    icon: BarChart3,
    title: 'Analytics dashboard',
    detail: 'A clear command center for a growing SaaS',
    prompt: 'Build a clean analytics dashboard for a growing SaaS with revenue metrics, activity trends, and a recent customer table.',
  },
  {
    icon: PanelsTopLeft,
    title: 'Product landing page',
    detail: 'A confident launch for a new creative tool',
    prompt: 'Create a striking product landing page for an AI creative tool with a bold hero, workflow section, social proof, and waitlist CTA.',
  },
]

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="welcome-lockup">
        <div className="welcome-mark"><BrandMark size="large" /></div>
        <div className="welcome-kicker"><Sparkles size={13} /> Your idea, assembled</div>
        <h1>What should we build?</h1>
        <p>Describe the outcome. Hoolulu plans, creates, checks, and packages it behind the scenes.</p>
      </div>

      <div className="empty-composer-wrap">
        <Composer {...props} />
        <p className="composer-caption">
          Protected by the Frozen Core <span>·</span> Local mode works instantly
        </p>
      </div>

      <div className="starter-grid" aria-label="Starter prompts">
        {starters.map(({ icon: Icon, title, detail, prompt }) => (
          <button
            type="button"
            className="starter-card"
            key={title}
            disabled={props.busy}
            onClick={() => props.onChange(prompt)}
          >
            <span className="starter-icon"><Icon size={17} /></span>
            <span className="starter-copy"><strong>{title}</strong><small>{detail}</small></span>
            <ArrowUpRight className="starter-arrow" size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
