import { describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import {
  assessGraphBackendMigration,
  assessStandaloneLocationGeneration,
  buildDeferredCapabilitiesReport,
  needsHistoricalFactReview,
  resolveCloudInferenceRouting,
} from './deferredCapabilities.js'

describe('deferredCapabilities', () => {
  it('flags stage 2 inferred attributes at or below the historical confidence ceiling', () => {
    expect(needsHistoricalFactReview({
      sourceStage: 2,
      provenance: 'inferred',
      confidence: 0.6,
    })).toBe(true)
    expect(needsHistoricalFactReview({
      sourceStage: 2,
      provenance: 'inferred',
      confidence: 0.8,
    })).toBe(false)
    expect(needsHistoricalFactReview({
      sourceStage: 3,
      provenance: 'inferred',
      confidence: 0.4,
    })).toBe(false)
  })

  it('keeps SQLite until relationship volume crosses the graph threshold', () => {
    const db = createSqliteDatabase({ dbPath: ':memory:' })
    initializeDatabase(db)
    const assessment = assessGraphBackendMigration(db)
    expect(assessment.recommendGraphBackend).toBe(false)
    expect(assessment.currentBackend).toBe('sqlite_fk')
    db.close()
  })

  it('defaults cloud inference routing to local-first unless configured', () => {
    expect(resolveCloudInferenceRouting({}).mode).toBe('local-first')
    expect(resolveCloudInferenceRouting({
      CLOUD_INFERENCE_BASE_URL: 'https://example.com/v1',
    }).mode).toBe('hybrid')
  })

  it('reports standalone location generation as character-bound in v1', () => {
    expect(assessStandaloneLocationGeneration().allowed).toBe(false)
    expect(assessStandaloneLocationGeneration().stage).toBe(4)
  })

  it('returns the deferred P2 capability inventory', () => {
    const db = createSqliteDatabase({ dbPath: ':memory:' })
    initializeDatabase(db)
    const report = buildDeferredCapabilitiesReport(db)
    expect(report.capabilities).toHaveLength(7)
    expect(report.assessments.cloudInference.mode).toBe('local-first')
    db.close()
  })
})
