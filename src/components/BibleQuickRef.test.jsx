/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BibleQuickRef from './BibleQuickRef.jsx'

vi.mock('../lib/api/bibles.js', () => ({
  fetchBible: vi.fn(),
}))

import { fetchBible } from '../lib/api/bibles.js'

const sampleBible = {
  demographics: { gender: 'male', ageRange: '30s', eraLabel: '1990s' },
  physical: {
    height: 'tall',
    build: 'lean',
    face: 'angular cheekbones',
    eyes: 'brown',
    nose: 'straight',
    lips: 'thin',
    skin: 'olive',
  },
  wardrobe: { everyday: 'worn leather jacket', accessories: ['scarf'] },
  visuals: { portraitBrief: 'neutral portrait', continuityKeywords: ['freckles'] },
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('BibleQuickRef', () => {
  it('renders nothing when entityId is null or undefined', () => {
    const { container: nullContainer } = render(<BibleQuickRef entityId={null} />)
    expect(nullContainer.firstChild).toBeNull()

    cleanup()
    const { container: undefContainer } = render(<BibleQuickRef />)
    expect(undefContainer.firstChild).toBeNull()
  })

  it('renders at least 3 attribute rows when fetch returns a populated bible', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: sampleBible, provenance: {} })

    render(<BibleQuickRef entityId="ruslan_levashov" />)

    await waitFor(() => {
      expect(screen.getAllByTestId('bible-quickref-row').length).toBeGreaterThanOrEqual(3)
    })

    expect(screen.getByText('physical.face')).toBeTruthy()
    expect(screen.getByText('angular cheekbones')).toBeTruthy()
    expect(screen.getByText('wardrobe.everyday')).toBeTruthy()
    expect(screen.getByText('worn leather jacket')).toBeTruthy()
  })

  it('toggle collapses and expands the attribute panel', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: sampleBible, provenance: {} })

    render(<BibleQuickRef entityId="ent_quickref" />)

    await waitFor(() => {
      expect(screen.getAllByTestId('bible-quickref-row').length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('button', { name: /hide character bible/i })).toBeTruthy()
    expect(screen.getByText('physical.face')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /hide character bible/i }))
    expect(screen.queryByText('physical.face')).toBeNull()
    expect(screen.getByRole('button', { name: /show character bible/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /show character bible/i }))
    await waitFor(() => {
      expect(screen.getByText('physical.face')).toBeTruthy()
    })
  })

  it('shows error state with retry when fetch fails', async () => {
    vi.mocked(fetchBible).mockRejectedValueOnce(new Error('network down'))
    vi.mocked(fetchBible).mockResolvedValueOnce({ bible: sampleBible, provenance: {} })

    render(<BibleQuickRef entityId="ent_err" />)

    await waitFor(() => {
      expect(screen.getByText(/unable to load bible/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getAllByTestId('bible-quickref-row').length).toBeGreaterThan(0)
    })
  })
})
