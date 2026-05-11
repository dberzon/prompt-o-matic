import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const INSERT_PATTERN = /INSERT\s+INTO\s+entity_attributes/i
const SCAN_ROOTS = ['api', 'src', 'scripts']
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', '.claude', '.claude-flow', '.swarm'])

function isAllowlisted(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized === 'api/lib/db/repositories.js') return true
  return /\.test\.(js|jsx|mjs|ts|tsx)$/.test(normalized)
}

function collectSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files)
      continue
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }
  return files
}

function findDirectEntityAttributeInserts() {
  const violations = []
  for (const rootName of SCAN_ROOTS) {
    const rootPath = path.join(projectRoot, rootName)
    for (const filePath of collectSourceFiles(rootPath)) {
      const relativePath = path.relative(projectRoot, filePath)
      if (isAllowlisted(relativePath)) continue
      const content = fs.readFileSync(filePath, 'utf8')
      if (INSERT_PATTERN.test(content)) {
        violations.push(relativePath.replace(/\\/g, '/'))
      }
    }
  }
  return violations.sort()
}

describe('entity attribute provenance guard', () => {
  it('blocks direct INSERT INTO entity_attributes outside repositories.js and tests', () => {
    const violations = findDirectEntityAttributeInserts()
    expect(violations).toEqual([])
  })
})
