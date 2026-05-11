import { describe, expect, it } from 'vitest'
import {
  IPADAPTER_QWEN_DECISION,
  IPADAPTER_QWEN_RESEARCH,
  buildMinimalQwenIpAdapterWorkflowSpec,
} from './ipadapterFeasibility.js'

describe('IPAdapter feasibility spike', () => {
  it('records that current Qwen templates lack IPAdapter', () => {
    expect(IPADAPTER_QWEN_RESEARCH.finding).toMatch(/DiT/i)
    expect(IPADAPTER_QWEN_RESEARCH.references.length).toBeGreaterThan(0)
  })

  it('commits MVP continuity via reference-image path', () => {
    expect(IPADAPTER_QWEN_DECISION.decision).toBe('continue_reference_image_path')
  })

  it('exposes a minimal workflow spec placeholder', () => {
    const spec = buildMinimalQwenIpAdapterWorkflowSpec()
    expect(spec.status).toBe('spec_only')
    expect(spec.requiredNodes).toContain('IPAdapterApply')
  })
})
