/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { z } from 'zod'
import BibleSectionPanel from './BibleSectionPanel.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const demoSectionSchema = z
  .object({
    gender: z.string().min(1),
    ageRange: z.string().min(1),
    notes: z.string().optional(),
  })
  .strict()

describe('BibleSectionPanel', () => {
  it('renders each field with requirement marker', () => {
    render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'f', ageRange: '30', notes: 'x' }}
        approvalState="pending"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={() => {}}
      />,
    )
    const rows = screen.getAllByTestId('T_BIBLE_SECTION_FIELD_ROW')
    expect(rows).toHaveLength(3)
    expect(screen.getByTestId('T_BIBLE_FIELD_INPUT_gender').getAttribute('value')).toBe('f')
    expect(rows.some((r) => r.getAttribute('data-field') === 'gender' && r.getAttribute('data-requirement') === 'required')).toBe(
      true,
    )
    expect(rows.some((r) => r.getAttribute('data-field') === 'notes' && r.getAttribute('data-requirement') === 'recommended')).toBe(
      true,
    )
  })

  it('highlights missing required fields and soft-styles missing recommended', () => {
    render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: '', ageRange: '20' }}
        approvalState="pending"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={() => {}}
      />,
    )
    const genderRow = screen.getAllByTestId('T_BIBLE_SECTION_FIELD_ROW').find((r) => r.getAttribute('data-field') === 'gender')
    expect(genderRow?.getAttribute('data-missing')).toBe('1')
    expect(genderRow?.className).toMatch(/missingRequired/)

    const notesRow = screen.getAllByTestId('T_BIBLE_SECTION_FIELD_ROW').find((r) => r.getAttribute('data-field') === 'notes')
    expect(notesRow?.getAttribute('data-missing')).toBe('1')
    expect(notesRow?.className).toMatch(/missingRecommended/)
  })

  it('renders three visually distinct approval states', () => {
    const { rerender } = render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20' }}
        approvalState="pending"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={() => {}}
      />,
    )
    const badge = () => screen.getByTestId('T_BIBLE_SECTION_APPROVAL')
    expect(badge().getAttribute('data-state')).toBe('pending')
    expect(badge().className).toMatch(/pending/)

    rerender(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20' }}
        approvalState="approved"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={() => {}}
      />,
    )
    expect(badge().getAttribute('data-state')).toBe('approved')
    expect(badge().className).toMatch(/approved/)

    rerender(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20' }}
        approvalState="rejected"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={() => {}}
      />,
    )
    expect(badge().getAttribute('data-state')).toBe('rejected')
    expect(badge().className).toMatch(/rejected/)
  })

  it('is read-only when onChange is undefined but still allows approve/reject', () => {
    render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20', notes: 'n' }}
        approvalState="pending"
        onApprove={() => {}}
        onReject={() => {}}
      />,
    )
    expect(screen.queryByTestId('T_BIBLE_FIELD_INPUT_gender')).toBeNull()
    expect(screen.getAllByTestId('T_BIBLE_FIELD_READONLY').length).toBeGreaterThan(0)
    expect(screen.getByTestId('T_BIBLE_APPROVE').disabled).toBe(false)
    expect(screen.getByTestId('T_BIBLE_REJECT').disabled).toBe(false)
  })

  it('disables approve/reject when those callbacks are omitted', () => {
    render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20' }}
        approvalState="pending"
      />,
    )
    expect(screen.getByTestId('T_BIBLE_APPROVE').disabled).toBe(true)
    expect(screen.getByTestId('T_BIBLE_REJECT').disabled).toBe(true)
  })

  it('invokes onChange when editing', () => {
    const onChange = vi.fn()
    render(
      <BibleSectionPanel
        sectionName="demographics"
        sectionSchema={demoSectionSchema}
        values={{ gender: 'm', ageRange: '20' }}
        approvalState="pending"
        onApprove={() => {}}
        onReject={() => {}}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByTestId('T_BIBLE_FIELD_INPUT_gender'), { target: { value: 'nb' } })
    expect(onChange).toHaveBeenCalledWith('gender', 'nb')
  })
})
