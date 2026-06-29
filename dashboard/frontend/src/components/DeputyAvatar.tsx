import { useState, useEffect } from 'react'

interface DeputyAvatarProps {
  id: string | number | undefined
  nome: string
  size?: number
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getDeterministicGradient(name: string): string {
  const colors = [
    ['var(--avatar-gradient-1a)', 'var(--avatar-gradient-1b)'],
    ['var(--avatar-gradient-2a)', 'var(--avatar-gradient-2b)'],
    ['var(--avatar-gradient-3a)', 'var(--avatar-gradient-3b)'],
    ['var(--avatar-gradient-4a)', 'var(--avatar-gradient-4b)'],
    ['var(--avatar-gradient-5a)', 'var(--avatar-gradient-5b)'],
    ['var(--avatar-gradient-6a)', 'var(--avatar-gradient-6b)'],
    ['var(--avatar-gradient-7a)', 'var(--avatar-gradient-7b)'],
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  const [c1, c2] = colors[index]
  return `linear-gradient(135deg, ${c1}, ${c2})`
}

export function DeputyAvatar({ id, nome, size = 40 }: DeputyAvatarProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [id])

  const initials = getInitials(nome)
  const bgGradient = getDeterministicGradient(nome)

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    maxWidth: `${size}px`,
    maxHeight: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    flex: '0 0 auto',
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
  }

  const showFallback = hasError || !id || String(id).trim() === ''

  return (
    <div
      className={`deputy-avatar ${showFallback ? 'deputy-avatar-fallback' : 'deputy-avatar-img'}`}
      style={{
        ...containerStyle,
        background: showFallback ? bgGradient : 'var(--color-surface-elevated, #1a1a2e)',
        color: 'var(--color-text)',
        fontWeight: showFallback ? 700 : undefined,
        fontSize: showFallback ? `${Math.max(10, size * 0.38)}px` : undefined,
        userSelect: showFallback ? 'none' : undefined,
      }}
    >
      {showFallback ? (
        <span style={{ lineHeight: 1 }}>{initials}</span>
      ) : (
        <img
          className="deputy-avatar__image"
          src={`https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`}
          alt={nome}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  )
}
