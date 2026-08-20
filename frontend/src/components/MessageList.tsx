import { useEffect, useRef } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Build, Message } from '../types'
import { ArtifactCard } from './ArtifactCard'
import { BrandMark } from './BrandMark'

interface MessageListProps {
  messages: Message[]
  builds: Build[]
  streamingText: string
  busy: boolean
}

function CopyButton({ content }: { content: string }) {
  const copy = async (button: HTMLButtonElement) => {
    await navigator.clipboard.writeText(content)
    button.dataset.copied = 'true'
    window.setTimeout(() => delete button.dataset.copied, 1500)
  }
  return (
    <button
      className="copy-message"
      type="button"
      title="Copy response"
      onClick={(event) => void copy(event.currentTarget)}
    >
      <Copy className="copy-default" size={14} />
      <Check className="copy-done" size={14} />
      <span className="sr-only">Copy response</span>
    </button>
  )
}

function AssistantContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function MessageList({ messages, builds, streamingText, busy }: MessageListProps) {
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: streamingText ? 'auto' : 'smooth', block: 'end' })
  }, [messages, streamingText])

  const buildMap = new Map(builds.map((build) => [build.id, build]))

  return (
    <div className="message-scroll">
      <div className="message-list">
        {messages.map((message) => {
          const buildId = typeof message.meta.build_id === 'string' ? message.meta.build_id : null
          const build = buildId ? buildMap.get(buildId) : undefined
          return (
            <article className={`message message-${message.role}`} key={message.id}>
              <div className="message-avatar">
                {message.role === 'assistant' ? <BrandMark size="small" /> : <span>You</span>}
              </div>
              <div className="message-body">
                <div className="message-author">{message.role === 'assistant' ? 'Hoolulu' : 'You'}</div>
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <AssistantContent content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
                {build && <ArtifactCard build={build} />}
                {message.role === 'assistant' && <CopyButton content={message.content} />}
              </div>
            </article>
          )
        })}

        {busy && (
          <article className="message message-assistant streaming-message">
            <div className="message-avatar"><BrandMark size="small" /></div>
            <div className="message-body">
              <div className="message-author">Hoolulu</div>
              <div className="message-content">
                {streamingText ? (
                  <><AssistantContent content={streamingText} /><span className="stream-caret" /></>
                ) : (
                  <div className="thinking"><i /><i /><i /></div>
                )}
              </div>
            </div>
          </article>
        )}
        <div ref={bottom} className="scroll-anchor" />
      </div>
    </div>
  )
}
