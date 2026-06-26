import { Fragment, type ReactNode } from 'react'

// Renderizador de Markdown leve e sem dependencias externas, suficiente para a
// documentacao do painel: titulos, paragrafos, listas (com marcadores e
// numeradas), tabelas, blocos de codigo, citacoes e enfase inline (negrito,
// italico, codigo, links). Mantem o estilo do app via a classe .markdown.

interface MarkdownProps {
  source: string
  className?: string
}

let keySeed = 0
function nextKey(prefix: string): string {
  keySeed += 1
  return `${prefix}-${keySeed}`
}

// Enfase inline: negrito, italico, codigo e links.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Ordem importa: codigo cru primeiro para nao interpretar marcacoes dentro dele.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(<code key={nextKey('code')}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={nextKey('b')}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[')) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (linkMatch) {
        nodes.push(
          <a key={nextKey('a')} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(<em key={nextKey('i')}>{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
}

// Converte o texto Markdown em uma arvore de elementos React.
function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    // Bloco de codigo cercado por ```.
    if (/^\s*```/.test(line)) {
      const fence: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        fence.push(lines[i])
        i += 1
      }
      i += 1
      out.push(
        <pre key={nextKey('pre')}>
          <code>{fence.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Titulo: # .. ######
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length, 6)
      const Tag = (`h${level}`) as 'h1'
      out.push(<Tag key={nextKey('h')}>{renderInline(heading[2].trim())}</Tag>)
      i += 1
      continue
    }

    // Citacao: linhas iniciadas por >
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      out.push(<blockquote key={nextKey('q')}>{renderInline(quote.join(' '))}</blockquote>)
      continue
    }

    // Tabela: linha com | seguida de separador ---.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(line)
      i += 2
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        bodyRows.push(splitTableRow(lines[i]))
        i += 1
      }
      out.push(
        <table key={nextKey('table')} className="markdown__table">
          <thead>
            <tr>
              {header.map((cell, idx) => (
                <th key={idx}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    // Lista numerada.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      out.push(
        <ol key={nextKey('ol')}>
          {items.map((item) => (
            <li key={nextKey('li')}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Lista com marcadores (-, *, +).
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i += 1
      }
      out.push(
        <ul key={nextKey('ul')}>
          {items.map((item) => (
            <li key={nextKey('li')}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Paragrafo: agrega linhas consecutivas ate uma linha em branco ou bloco novo.
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i += 1
    }
    out.push(<p key={nextKey('p')}>{renderInline(para.join(' '))}</p>)
  }

  return out
}

export function Markdown({ source, className }: MarkdownProps) {
  if (!source?.trim()) return null
  return (
    <div className={`markdown${className ? ` ${className}` : ''}`}>
      {renderBlocks(source).map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </div>
  )
}
