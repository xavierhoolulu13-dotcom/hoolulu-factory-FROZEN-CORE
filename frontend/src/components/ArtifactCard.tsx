import { AlertTriangle, ArrowUpRight, Box, Download, FileArchive } from 'lucide-react'
import type { Build } from '../types'

interface ArtifactCardProps {
  build: Build
  dense?: boolean
}

export function ArtifactCard({ build, dense = false }: ArtifactCardProps) {
  if (build.status === 'failed') {
    return (
      <div className={`artifact-card failed ${dense ? 'dense' : ''}`}>
        <span className="artifact-file-icon"><AlertTriangle size={19} /></span>
        <span className="artifact-info">
          <strong>Build held by Frozen Core</strong>
          <small>No artifact was released</small>
        </span>
      </div>
    )
  }

  if (build.status !== 'completed') {
    return (
      <div className={`artifact-card ${dense ? 'dense' : ''}`}>
        <span className="artifact-file-icon working"><Box size={19} /></span>
        <span className="artifact-info">
          <strong>Building project</strong>
          <small>{build.stage || 'Queued'}</small>
        </span>
      </div>
    )
  }

  return (
    <div className={`artifact-card ${dense ? 'dense' : ''}`}>
      <span className="artifact-file-icon"><FileArchive size={20} /></span>
      <span className="artifact-info">
        <strong>Project source</strong>
        <small>Validated · ZIP archive</small>
      </span>
      <span className="artifact-actions">
        {build.preview_url && (
          <a href={build.preview_url} target="_blank" rel="noreferrer" title="Open preview">
            <ArrowUpRight size={17} /> <span>Preview</span>
          </a>
        )}
        {build.download_url && (
          <a href={build.download_url} title="Download source">
            <Download size={17} /> <span className="sr-only">Download source</span>
          </a>
        )}
      </span>
    </div>
  )
}
