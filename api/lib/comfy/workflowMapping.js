import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORKFLOW_ID = 'qwen-image-2512-default'
const WORKFLOWS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'workflows')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function setMappedInput(workflow, mappingEntry, value) {
  const node = workflow?.[mappingEntry.nodeId]
  if (!node || typeof node !== 'object') {
    throw new Error(`Mapped node "${mappingEntry.nodeId}" not found in workflow`)
  }
  if (!node.inputs || typeof node.inputs !== 'object') {
    throw new Error(`Node "${mappingEntry.nodeId}" has no inputs object`)
  }
  if (!(mappingEntry.inputKey in node.inputs)) {
    throw new Error(`Mapped input "${mappingEntry.inputKey}" not found on node "${mappingEntry.nodeId}"`)
  }
  node.inputs[mappingEntry.inputKey] = value
}

function readJsonFile(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    const err = new Error(`Invalid ${label} JSON: ${path.basename(filePath)}`)
    err.status = 400
    err.meta = error?.message || ''
    throw err
  }
}

function buildFilesMap({ workflowsDir = WORKFLOWS_DIR } = {}) {
  const entries = fs.existsSync(workflowsDir) ? fs.readdirSync(workflowsDir) : []
  const ids = new Set()
  for (const name of entries) {
    if (name.endsWith('.mapping.json')) {
      ids.add(name.replace(/\.mapping\.json$/, ''))
    } else if (name.endsWith('.json')) {
      ids.add(name.replace(/\.json$/, ''))
    }
  }
  const map = new Map()
  for (const workflowId of ids) {
    map.set(workflowId, {
      workflowId,
      templatePath: path.join(workflowsDir, `${workflowId}.json`),
      mappingPath: path.join(workflowsDir, `${workflowId}.mapping.json`),
    })
  }
  return map
}

export function listAvailableWorkflows({ workflowsDir = WORKFLOWS_DIR } = {}) {
  const files = buildFilesMap({ workflowsDir })
  const output = []
  for (const item of files.values()) {
    const hasTemplate = fs.existsSync(item.templatePath)
    const hasMapping = fs.existsSync(item.mappingPath)
    const errors = []
    if (!hasTemplate) errors.push('Missing workflow template JSON file')
    if (!hasMapping) errors.push('Missing workflow mapping JSON file')
    let valid = hasTemplate && hasMapping
    if (valid) {
      try {
        const workflow = readJsonFile(item.templatePath, 'workflow template')
        const mapping = readJsonFile(item.mappingPath, 'workflow mapping')
        const validation = validateWorkflowMapping({ workflow, mapping })
        if (!validation.ok) {
          valid = false
          errors.push(...validation.errors)
        }
      } catch (error) {
        valid = false
        errors.push(error?.message || 'Workflow parse error')
      }
    }
    output.push({
      workflowId: item.workflowId,
      hasTemplate,
      hasMapping,
      valid,
      errors,
    })
  }
  return output.sort((a, b) => a.workflowId.localeCompare(b.workflowId))
}

export function workflowExists(workflowId, { workflowsDir = WORKFLOWS_DIR } = {}) {
  const files = buildFilesMap({ workflowsDir })
  const item = files.get(workflowId)
  return Boolean(item && fs.existsSync(item.templatePath) && fs.existsSync(item.mappingPath))
}

export function loadWorkflowTemplate(workflowId = DEFAULT_WORKFLOW_ID, { workflowsDir = WORKFLOWS_DIR } = {}) {
  const templatePath = path.join(workflowsDir, `${workflowId}.json`)
  if (!fs.existsSync(templatePath)) {
    const err = new Error(`Workflow template "${workflowId}" not found`)
    err.status = 400
    throw err
  }
  return clone(readJsonFile(templatePath, 'workflow template'))
}

export function loadWorkflowMapping(workflowId = DEFAULT_WORKFLOW_ID, { workflowsDir = WORKFLOWS_DIR } = {}) {
  const mappingPath = path.join(workflowsDir, `${workflowId}.mapping.json`)
  if (!fs.existsSync(mappingPath)) {
    const err = new Error(`Workflow mapping "${workflowId}" not found`)
    err.status = 400
    throw err
  }
  return clone(readJsonFile(mappingPath, 'workflow mapping'))
}

export function resolveWorkflowId(workflowId, { workflowsDir = WORKFLOWS_DIR } = {}) {
  if (workflowId && workflowExists(workflowId, { workflowsDir })) return workflowId
  return DEFAULT_WORKFLOW_ID
}

export function resolveWorkflowSelection(workflowId, { allowFallback = true, workflowsDir = WORKFLOWS_DIR } = {}) {
  const requestedWorkflowId = typeof workflowId === 'string' && workflowId.trim() ? workflowId.trim() : null
  if (!requestedWorkflowId) {
    return {
      requestedWorkflowId: null,
      resolvedWorkflowId: DEFAULT_WORKFLOW_ID,
      usedFallback: false,
    }
  }
  if (workflowExists(requestedWorkflowId, { workflowsDir })) {
    return {
      requestedWorkflowId,
      resolvedWorkflowId: requestedWorkflowId,
      usedFallback: false,
    }
  }
  if (allowFallback) {
    return {
      requestedWorkflowId,
      resolvedWorkflowId: DEFAULT_WORKFLOW_ID,
      usedFallback: true,
    }
  }
  const err = new Error(`Unknown workflowId "${requestedWorkflowId}". Use GET /api/comfy-workflows to list valid workflow IDs.`)
  err.status = 400
  err.code = 'UNKNOWN_WORKFLOW_ID'
  throw err
}

export function validateWorkflowMapping({ workflow, mapping }) {
  const errors = []
  const requiredKeys = ['positivePrompt', 'negativePrompt', 'seed', 'width', 'height']
  const found = {}
  for (const key of requiredKeys) {
    const entry = mapping?.fields?.[key]
    if (!entry?.nodeId || !entry?.inputKey) {
      errors.push(`Missing required mapping for "${key}"`)
      continue
    }
    const node = workflow?.[entry.nodeId]
    if (!node) {
      errors.push(`Mapped node "${entry.nodeId}" for "${key}" not found`)
      continue
    }
    if (!node.inputs || !(entry.inputKey in node.inputs)) {
      errors.push(`Mapped input "${entry.inputKey}" for "${key}" not found on node "${entry.nodeId}"`)
      continue
    }
    found[key] = { nodeId: entry.nodeId, inputKey: entry.inputKey }
  }
  return {
    ok: errors.length === 0,
    found,
    errors,
  }
}

export function injectPromptPackIntoWorkflow({
  workflow,
  mapping,
  promptPack,
  seed,
  width,
  height,
  modelName,
  batchSize = 1,
}) {
  const validation = validateWorkflowMapping({ workflow, mapping })
  if (!validation.ok) {
    const err = new Error(`Invalid workflow mapping: ${validation.errors.join('; ')}`)
    err.status = 400
    err.details = validation
    throw err
  }
  setMappedInput(workflow, mapping.fields.positivePrompt, promptPack.positivePrompt)
  setMappedInput(workflow, mapping.fields.negativePrompt, promptPack.negativePrompt || '')
  setMappedInput(workflow, mapping.fields.seed, seed)
  setMappedInput(workflow, mapping.fields.width, width)
  setMappedInput(workflow, mapping.fields.height, height)
  if (mapping.fields.batchSize) {
    setMappedInput(workflow, mapping.fields.batchSize, batchSize)
  }
  if (modelName && mapping.optionalFields?.modelName) {
    setMappedInput(workflow, mapping.optionalFields.modelName, modelName)
  }
  return workflow
}
