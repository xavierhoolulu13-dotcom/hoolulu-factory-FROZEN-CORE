export type Mode = 'build' | 'chat'
export type Role = 'user' | 'assistant' | 'system'

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: Role
  content: string
  mode: Mode
  meta: Record<string, unknown>
  created_at: string
}

export interface Build {
  id: string
  conversation_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: string
  prompt: string
  summary: string | null
  error: string | null
  created_at: string
  updated_at: string
  download_url: string | null
  preview_url: string | null
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[]
  builds: Build[]
}

export interface CoreDocument {
  name: string
  version: string
  status: string
  purpose: string
  principles: Array<{ id: string; rule: string }>
  builder_contract: Record<string, unknown>
}

export interface CoreResponse {
  digest: string
  read_only: boolean
  document: CoreDocument
}

export interface HealthResponse {
  status: string
  service: string
  core: string
  model_connected: boolean
}

export interface ProgressItem {
  stage: string
  detail: string
}

export interface FactoryEvent {
  event: string
  data: Record<string, unknown>
}
