import type { ChartSpec } from '../types'

interface WordCloudImage {
  year: number | string
  src: string
  alt?: string
}

interface WordCloudGridProps {
  spec: ChartSpec
}

function getImages(spec: ChartSpec): WordCloudImage[] {
  const images = spec.options.images
  if (!Array.isArray(images)) return []
  return images
    .map((item) => item as Partial<WordCloudImage>)
    .filter((item): item is WordCloudImage => Boolean(item.year && item.src))
    .sort((a, b) => Number(a.year) - Number(b.year))
}

export function WordCloudGrid({ spec }: WordCloudGridProps) {
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
          <article className="wordcloud-card" key={String(image.year)}>
            <h3>{image.year}</h3>
            <img src={image.src} alt={image.alt ?? `Nuvem de palavras ${image.year}`} />
          </article>
        ))}
      </div>
    </section>
  )
}
