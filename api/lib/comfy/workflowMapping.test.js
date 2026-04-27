import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listAvailableWorkflows,
  resolveWorkflowId,
  resolveWorkflowSelection,
  workflowExists,
} from './workflowMapping.js'

const tempDirs = []

function createTempWorkflowDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-workflow-map-test-'))
  tempDirs.push(dir)
  return dir
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('workflow discovery mapping', () => {
  it('discovers valid workflow pair', () => {
    const dir = createTempWorkflowDir()
    writeJson(path.join(dir, 'wfA.json'), { '1': { inputs: { text: '' } }, '2': { inputs: { text: '' } }, '3': { inputs: { seed: 1 } }, '4': { inputs: { width: 1, height: 1 } } })
    writeJson(path.join(dir, 'wfA.mapping.json'), {
      fields: {
        positivePrompt: { nodeId: '1', inputKey: 'text' },
        negativePrompt: { nodeId: '2', inputKey: 'text' },
        seed: { nodeId: '3', inputKey: 'seed' },
        width: { nodeId: '4', inputKey: 'width' },
        height: { nodeId: '4', inputKey: 'height' },
      },
    })
    const workflows = listAvailableWorkflows({ workflowsDir: dir })
    expect(workflows[0].workflowId).toBe('wfA')
    expect(workflows[0].valid).toBe(true)
  })

  it('reports missing mapping clearly', () => {
    const dir = createTempWorkflowDir()
    writeJson(path.join(dir, 'wfMissingMap.json'), { '1': { inputs: { text: '' } } })
    const workflows = listAvailableWorkflows({ workflowsDir: dir })
    expect(workflows[0].hasTemplate).toBe(true)
    expect(workflows[0].hasMapping).toBe(false)
    expect(workflows[0].errors.some((e) => e.includes('Missing workflow mapping'))).toBe(true)
  })

  it('reports missing template clearly', () => {
    const dir = createTempWorkflowDir()
    writeJson(path.join(dir, 'wfMissingTemplate.mapping.json'), {
      fields: {
        positivePrompt: { nodeId: '1', inputKey: 'text' },
      },
    })
    const workflows = listAvailableWorkflows({ workflowsDir: dir })
    expect(workflows[0].hasTemplate).toBe(false)
    expect(workflows[0].hasMapping).toBe(true)
    expect(workflows[0].errors.some((e) => e.includes('Missing workflow template'))).toBe(true)
  })

  it('unknown workflow resolves to default fallback', () => {
    const dir = createTempWorkflowDir()
    expect(resolveWorkflowId('unknown-workflow', { workflowsDir: dir })).toBe('qwen-image-2512-default')
    expect(workflowExists('unknown-workflow', { workflowsDir: dir })).toBe(false)
  })

  it('strict selection fails on unknown workflow id', () => {
    const dir = createTempWorkflowDir()
    expect(() => resolveWorkflowSelection('unknown-workflow', {
      workflowsDir: dir,
      allowFallback: false,
    })).toThrow('Unknown workflowId')
  })
})
