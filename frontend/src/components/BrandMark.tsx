interface BrandMarkProps {
  size?: 'small' | 'medium' | 'large'
}

export function BrandMark({ size = 'medium' }: BrandMarkProps) {
  return (
    <span className={`brand-mark brand-mark-${size}`} aria-hidden="true">
      <span className="brand-orbit" />
      <span className="brand-core" />
    </span>
  )
}
