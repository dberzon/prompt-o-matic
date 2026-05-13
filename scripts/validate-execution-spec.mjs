#!/usr/bin/env node
// Dry-run validator for docs/execution-spec.yaml.
// Checks: field completeness, DAG (cycles), file-scope isolation, ID references.
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const SPEC = path.resolve('docs/execution-spec.yaml')
const raw = fs.readFileSync(SPEC, 'utf8')
const doc = YAML.parse(raw)

const items = doc.items || []
const idToItem = new Map(items.map((i) => [i.id, i]))
const errors = []
const warnings = []

const REQUIRED_FIELDS = [
  'id', 'title', 'phase', 'priority', 'est_days', 'why',
  'files_in_scope', 'out_of_scope', 'api_contract',
  'acceptance_criteria', 'test_plan', 'depends_on', 'blocks',
  'risk', 'rollback',
]

for (const it of items) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in it)) errors.push(`[${it.id || '?'}] missing field: ${f}`)
  }
  if (typeof it.est_days === 'number' && it.est_days > 1.0) {
    warnings.push(`[${it.id}] est_days=${it.est_days} (>1.0)`)
  }
  if (!Array.isArray(it.acceptance_criteria) || it.acceptance_criteria.length === 0) {
    errors.push(`[${it.id}] acceptance_criteria is empty`)
  }
  if (!Array.isArray(it.test_plan) || it.test_plan.length === 0) {
    errors.push(`[${it.id}] test_plan is empty`)
  }
}

for (const it of items) {
  for (const d of (it.depends_on || [])) {
    if (!idToItem.has(d)) errors.push(`[${it.id}] depends_on unknown id: ${d}`)
  }
  for (const b of (it.blocks || [])) {
    if (!idToItem.has(b)) errors.push(`[${it.id}] blocks unknown id: ${b}`)
  }
}

const graph = new Map(items.map((i) => [i.id, new Set(i.depends_on || [])]))
for (const it of items) {
  for (const b of (it.blocks || [])) {
    if (graph.has(b)) graph.get(b).add(it.id)
  }
}

const WHITE = 0, GRAY = 1, BLACK = 2
const color = new Map(items.map((i) => [i.id, WHITE]))
const cycles = []
function dfs(node, stack) {
  color.set(node, GRAY)
  for (const dep of graph.get(node) || []) {
    if (color.get(dep) === GRAY) {
      const i = stack.indexOf(dep)
      cycles.push(stack.slice(i).concat(dep).join(' -> '))
    } else if (color.get(dep) === WHITE) {
      dfs(dep, [...stack, dep])
    }
  }
  color.set(node, BLACK)
}
for (const it of items) {
  if (color.get(it.id) === WHITE) dfs(it.id, [it.id])
}

function reachable(from, to) {
  const seen = new Set()
  const stack = [from]
  while (stack.length) {
    const n = stack.pop()
    if (n === to) return true
    if (seen.has(n)) continue
    seen.add(n)
    for (const dep of (graph.get(n) || [])) stack.push(dep)
  }
  return false
}

const fileToItems = new Map()
function stripMarker(s) { return String(s || '').replace(/#.*$/, '').trim() }
for (const it of items) {
  for (const f of (it.files_in_scope || [])) {
    const file = stripMarker(f)
    if (!file) continue
    if (!fileToItems.has(file)) fileToItems.set(file, [])
    fileToItems.get(file).push(it.id)
  }
}

const sharedFileViolations = []
for (const [file, ids] of fileToItems.entries()) {
  if (ids.length < 2) continue
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j]
      if (!reachable(a, b) && !reachable(b, a)) {
        sharedFileViolations.push({ file, a, b })
      }
    }
  }
}

const referencedAppendix = new Set()
for (const chain of doc.appendix_c_dependency_graph?.shared_file_chains || []) {
  for (const ent of (chain.chain || [])) {
    if (typeof ent === 'string' && ent.startsWith('arch.')) referencedAppendix.add(ent)
  }
}
for (const stepObj of doc.appendix_a_critical_path?.chain || []) {
  if (stepObj?.id) referencedAppendix.add(stepObj.id)
}
const danglingAppendixRefs = [...referencedAppendix].filter((id) => !idToItem.has(id) && !id.startsWith('arch.phase6.') && !id.startsWith('arch.phase7.'))

const countsByPhase = new Map()
let totalDays = 0
for (const it of items) {
  countsByPhase.set(it.phase, (countsByPhase.get(it.phase) || 0) + 1)
  totalDays += Number(it.est_days || 0)
}

console.log('=== Execution Spec Validation ===\n')
console.log(`Items total:        ${items.length}`)
for (const [p, c] of [...countsByPhase.entries()].sort()) {
  console.log(`  Phase ${p}:          ${c} items`)
}
console.log(`Engineer-days sum:  ${totalDays.toFixed(2)}\n`)

console.log(`Cycles found:                  ${cycles.length === 0 ? 'NONE' : cycles.length}`)
for (const c of cycles) console.log(`  CYCLE: ${c}`)
console.log()

console.log(`Field-completeness errors:     ${errors.filter((e) => e.includes('missing field') || e.includes('is empty')).length}`)
console.log(`Unknown-ID-reference errors:   ${errors.filter((e) => e.includes('unknown id')).length}`)
console.log(`Other warnings:                ${warnings.length}\n`)

console.log(`Files shared by 2+ items:      ${[...fileToItems.values()].filter((v) => v.length >= 2).length}`)
console.log(`File-isolation violations:     ${sharedFileViolations.length}`)
for (const v of sharedFileViolations) {
  console.log(`  VIOLATION: file=${v.file}  items=[${v.a}, ${v.b}]  (no dependency edge)`)
}
console.log()

console.log(`Dangling appendix references:  ${danglingAppendixRefs.length}`)
for (const r of danglingAppendixRefs) console.log(`  DANGLING: ${r}`)
console.log()

if (errors.length) {
  console.log('=== Errors ===')
  for (const e of errors) console.log(`  ${e}`)
  console.log()
}
if (warnings.length) {
  console.log('=== Warnings ===')
  for (const w of warnings) console.log(`  ${w}`)
}

const exitCode = (cycles.length > 0 || errors.length > 0 || sharedFileViolations.length > 0) ? 1 : 0
process.exit(exitCode)
