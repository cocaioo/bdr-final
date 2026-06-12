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
    ['#2A9D8F', '#264653'],
    ['#E76F51', '#F4A261'],
    ['#E9C46A', '#F4A261'],
    ['#1D3557', '#457B9D'],
    ['#E63946', '#1D3557'],
    ['#8D99AE', '#2B2D42'],
    ['#6C5B7B', '#355C7D'],
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

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  }

  if (hasError || !id || String(id).trim() === '') {
    return (
      <div
        className="deputy-avatar-fallback"
        style={{
          ...containerStyle,
          background: bgGradient,
          color: '#ffffff',
          fontWeight: 600,
          fontSize: `${Math.max(10, size * 0.38)}px`,
          userSelect: 'none',
        }}
      >
        {initials}
      </div>
    )
  }

  const imageUrl = `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`

  return (
    <img
      className="deputy-avatar-img"
      src={imageUrl}
      alt={nome}
      style={{
        ...containerStyle,
        objectFit: 'cover',
      }}
      onError={() => setHasError(true)}
    />
  )
}
