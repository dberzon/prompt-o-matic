import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverTools } from './discover.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('discoverTools', () => {
  it('discovers only *.tool.js files in stable path order', async () => {
    const dir = path.join(__dirname, 'fixtures', 'discover', 'good')
    const tools = await discoverTools({ dir })
    expect(tools).toHaveLength(3)
    expect(tools.map((t) => t.name)).toEqual(['apple', 'mango', 'zebra'])
  })

  it('throws when tool name does not match file stem', async () => {
    const dir = path.join(__dirname, 'fixtures', 'discover', 'name-mismatch')
    await expect(discoverTools({ dir })).rejects.toThrow(/does not match file stem/)
  })

  it('throws on duplicate tool names across subdirectories', async () => {
    const dir = path.join(__dirname, 'fixtures', 'discover', 'dup')
    await expect(discoverTools({ dir })).rejects.toThrow(/Duplicate tool name "echo"/)
  })
})
