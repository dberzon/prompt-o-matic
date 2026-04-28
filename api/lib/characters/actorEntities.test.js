import { describe, expect, it } from 'vitest'
import { parseActorAudition, parseActorCandidate } from './schemas.js'

const ISO = '2026-04-28T12:00:00.000Z'

function makeCandidate(overrides = {}) {
  return {
    id: 'actor_001',
    status: 'available',
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  }
}

function makeAudition(overrides = {}) {
  return {
    id: 'audition_001',
    actorCandidateId: 'actor_001',
    bankEntryId: 'bank_001',
    status: 'pending',
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  }
}

describe('ActorCandidateSchema', () => {
  it('accepts well-formed entry with optional fields omitted', () => {
    const parsed = parseActorCandidate(makeCandidate())
    expect(parsed.status).toBe('available')
    expect(parsed.sourceBankEntryId).toBeUndefined()
    expect(parsed.promptPackId).toBeUndefined()
    expect(parsed.notes).toBeUndefined()
  })

  it('accepts entry with sourceBankEntryId, promptPackId, and notes set', () => {
    const parsed = parseActorCandidate(makeCandidate({
      sourceBankEntryId: 'bank_123',
      promptPackId: 'pack_456',
      notes: 'Reusable actor',
    }))
    expect(parsed.sourceBankEntryId).toBe('bank_123')
    expect(parsed.promptPackId).toBe('pack_456')
    expect(parsed.notes).toBe('Reusable actor')
  })

  it('rejects status not in allowed enum', () => {
    expect(() => parseActorCandidate(makeCandidate({ status: 'draft' }))).toThrow()
  })

  it('rejects missing id, createdAt, and updatedAt', () => {
    expect(() => parseActorCandidate({
      status: 'available',
    })).toThrow()
  })

  it('rejects unknown extra fields', () => {
    expect(() => parseActorCandidate(makeCandidate({ extraField: true }))).toThrow()
  })
})

describe('ActorAuditionSchema', () => {
  it('accepts well-formed pending audition', () => {
    const parsed = parseActorAudition(makeAudition())
    expect(parsed.status).toBe('pending')
  })

  it('accepts approved audition with notes', () => {
    const parsed = parseActorAudition(makeAudition({
      status: 'approved',
      notes: 'Strong fit',
    }))
    expect(parsed.status).toBe('approved')
    expect(parsed.notes).toBe('Strong fit')
  })

  it('accepts rejected audition with rejectedReason', () => {
    const parsed = parseActorAudition(makeAudition({
      status: 'rejected',
      rejectedReason: 'Not aligned to look',
    }))
    expect(parsed.status).toBe('rejected')
    expect(parsed.rejectedReason).toBe('Not aligned to look')
  })

  it('accepts audition with similarityScore as number', () => {
    const parsed = parseActorAudition(makeAudition({
      similarityScore: 0.82,
    }))
    expect(parsed.similarityScore).toBe(0.82)
  })

  it('rejects status not in allowed enum', () => {
    expect(() => parseActorAudition(makeAudition({ status: 'queued' }))).toThrow()
  })

  it('rejects missing actorCandidateId or bankEntryId', () => {
    expect(() => parseActorAudition(makeAudition({ actorCandidateId: undefined }))).toThrow()
    expect(() => parseActorAudition(makeAudition({ bankEntryId: undefined }))).toThrow()
  })
})
