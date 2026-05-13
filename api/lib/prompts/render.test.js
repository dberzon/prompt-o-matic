import { describe, expect, it, vi } from 'vitest'
import { PromptRenderError, renderPrompt } from './render.js'

describe('renderPrompt', () => {
  it('substitutes {{var}} and dotted paths', () => {
    const out = renderPrompt('Hi {{name}} / {{entity.name}}', {
      name: 'A',
      entity: { name: 'B' },
    })
    expect(out).toBe('Hi A / B')
  })

  it('iterates {{#each}} over strings with {{this}}', () => {
    const t = '{{#each tags}}[{{this}}]{{/each}}'
    const out = renderPrompt(t, { tags: ['a', 'b'] })
    expect(out).toBe('[a][b]')
  })

  it('iterates {{#each}} over objects', () => {
    const t = '{{#each people}}{{name}}:{{id}}|{{/each}}'
    const out = renderPrompt(t, {
      people: [
        { name: 'Ann', id: '1' },
        { name: 'Bo', id: '2' },
      ],
    })
    expect(out).toBe('Ann:1|Bo:2|')
  })

  it('renders {{#if}} with {{else}}', () => {
    expect(renderPrompt('{{#if on}}yes{{else}}no{{/if}}', { on: true })).toBe('yes')
    expect(renderPrompt('{{#if on}}yes{{else}}no{{/if}}', { on: false })).toBe('no')
  })

  it('supports nested {{#each}}', () => {
    const t = '{{#each rows}}{{row}}:{{#each cells}}{{this}},{{/each}};{{/each}}'
    const out = renderPrompt(t, { rows: [{ row: 'r1', cells: ['a', 'b'] }] })
    expect(out).toBe('r1:a,b,;')
  })

  it('warns once for unknown variables and renders empty', () => {
    const warn = vi.fn()
    const out = renderPrompt('x{{missing}}y{{missing}}z', {}, { warn })
    expect(out).toBe('xyz')
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('missing')).length).toBeGreaterThanOrEqual(1)
  })

  it('does not throw on benign templates', () => {
    expect(() => renderPrompt('', {})).not.toThrow()
  })

  it('throws PromptRenderError on malformed block', () => {
    expect(() => renderPrompt('{{#if a}}no close', {})).toThrow(PromptRenderError)
  })
})
