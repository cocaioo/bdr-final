import { useEffect, useState, useRef } from 'react'
import type { ChartSpec } from '../types'

interface WordCloudImage {
  year: number | string
  src: string
  alt?: string
}

interface WordCloudGridProps {
  spec: ChartSpec
  selectedTheme: string | null
  onWordClick: (word: string) => void
}

interface WordCloudCardProps {
  year: number | string
  src: string
  selectedTheme: string | null
  onWordClick: (word: string) => void
}

function getImages(spec: ChartSpec): WordCloudImage[] {
  const images = spec.options.images
  if (!Array.isArray(images)) return []
  return images
    .map((item) => item as Partial<WordCloudImage>)
    .filter((item): item is WordCloudImage => Boolean(item.year && item.src))
    .sort((a, b) => Number(a.year) - Number(b.year))
}

export function WordCloudCard({ year, src, selectedTheme: _selectedTheme, onWordClick: _onWordClick }: WordCloudCardProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (active) {
          let processedText = text
          if (!processedText.includes('viewBox')) {
            processedText = processedText.replace('<svg ', '<svg viewBox="0 0 1280 720" ')
          }
          setSvgContent(processedText)
        }
      })
      .catch((err) => {
        console.error('Failed to load wordcloud SVG:', err)
      })
    return () => {
      active = false
    }
  }, [src])

  useEffect(() => {
    if (!wrapperRef.current || !svgContent) return
    const texts = wrapperRef.current.querySelectorAll('text')
    texts.forEach((textNode) => {
      textNode.style.opacity = '1'
      textNode.style.filter = 'none'
      textNode.classList.remove('selected-word')
    })
  }, [svgContent])

  const handleClick = (_e: React.MouseEvent<HTMLDivElement>) => {
    // Clicabilidade temporariamente desativada
  }

  return (
    <article className="wordcloud-card" key={String(year)}>
      <h3>{year}</h3>
      {svgContent ? (
        <div
          ref={wrapperRef}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: svgContent }}
          className="wordcloud-svg-wrapper"
        />
      ) : (
        <div className="wordcloud-loading" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
          Carregando nuvem...
        </div>
      )}
    </article>
  )
}

export function WordCloudGrid({ spec, selectedTheme, onWordClick }: WordCloudGridProps) {
  const images = getImages(spec)

  if (!images.length) return null

  return (
    <section className="wordcloud-section stagger-item">
      <header>
        <h2>{spec.title}</h2>
        <p>{spec.description}</p>
      </header>
      <div className="wordcloud-grid">
        {images.map((image) => (
          <WordCloudCard
            key={String(image.year)}
            year={image.year}
            src={image.src}
            selectedTheme={selectedTheme}
            onWordClick={onWordClick}
          />
        ))}
      </div>
    </section>
  )
}
