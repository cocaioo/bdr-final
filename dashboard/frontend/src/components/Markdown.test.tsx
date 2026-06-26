import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renderiza títulos, parágrafos e ênfase', () => {
    render(<Markdown source={'# Título\n\nUm **negrito** e *itálico* e `código`.'} />)
    expect(screen.getByRole('heading', { name: 'Título', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('negrito').tagName).toBe('STRONG')
    expect(screen.getByText('itálico').tagName).toBe('EM')
    expect(screen.getByText('código').tagName).toBe('CODE')
  })

  it('renderiza listas com marcadores e numeradas', () => {
    render(<Markdown source={'- a\n- b\n\n1. um\n2. dois'} />)
    const lists = screen.getAllByRole('list')
    expect(lists).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('renderiza tabelas', () => {
    render(<Markdown source={'| A | B |\n| --- | --- |\n| 1 | 2 |'} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
  })

  it('renderiza blocos de código cercados', () => {
    const { container } = render(<Markdown source={'```\nconst x = 1\n```'} />)
    const pre = container.querySelector('pre code')
    expect(pre?.textContent).toContain('const x = 1')
  })
})
