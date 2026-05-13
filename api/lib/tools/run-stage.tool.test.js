import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, listAttributes } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createRegistry } from './registrar.js'
import runStageTool, { clearRunStageContext, setRunStageContext } from './run-stage.tool.js'

const tempDirs = []
/** @type {import('better-sqlite3').Database | null} */
let activeDb = null

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-run-stage-tool-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  activeDb = db
  return { db, dbPath }
}

afterEach(() => {
  clearRunStageContext()
  if (activeDb) {
    try {
      activeDb.close()
    } catch {
      // ignore
    }
    activeDb = null
  }
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('run-stage tool', () => {
  it('delegates to orchestrator runStage, persists attributes, and maps dropped to droppedItems', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_rs_tool', type: 'character', name: 'Test' })
    const llm = async ({ user }) => {
      if (user.includes('Project likely environments and relationship-derived')) {
        return JSON.stringify({
          environments: [],
          attributes: [{ key: 'routine.friday', value: 'rest', confidence: 0.7 }],
          relationshipAttributes: [{ type: 'ally', otherSlug: '   ', value: 'should drop', confidence: 0.8 }],
        })
      }
      return '{}'
    }
    setRunStageContext({ db, llm })

    const reg = createRegistry({ tools: [runStageTool] })
    const out = await reg.invoke('run-stage', { entityId: entity.id, stageId: 4 })

    expect(out.ok).toBe(true)
    expect(out.attributes.some((a) => a.key === 'routine.friday')).toBe(true)
    expect(out.droppedItems).toHaveLength(1)
    expect(out.droppedItems[0]).toMatchObject({ key: 'ally', reason: 'relationship_other_slug_empty' })

    const attrs = listAttributes(db, { entityId: entity.id, key: 'routine.friday' })
    expect(attrs.length).toBeGreaterThanOrEqual(1)
  })

  it('throws unknown stage with typed code and HTTP 400 (not 500)', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_rs_bad_stage', type: 'character', name: 'X' })
    setRunStageContext({ db, llm: async () => '{}' })

    const reg = createRegistry({ tools: [runStageTool] })
    await expect(reg.invoke('run-stage', { entityId: entity.id, stageId: 99 })).rejects.toSatisfy(
      (e) =>
        e instanceof Error
        && e.message.includes('Unknown extrapolation stage')
        && e.status === 400
        && e.code === 'UNKNOWN_EXTRAPOLATION_STAGE',
    )
  })

  it('passes variables.prior into the orchestrator', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_rs_prior', type: 'character', name: 'Y' })
    let sawPrior = false
    const llm = async ({ user }) => {
      if (user.includes('Project likely environments and relationship-derived')) {
        sawPrior = user.includes('stub-prior-marker')
        return JSON.stringify({
          environments: [],
          attributes: [{ key: 'routine.friday', value: 'rest', confidence: 0.7 }],
        })
      }
      return '{}'
    }
    setRunStageContext({ db, llm })

    const reg = createRegistry({ tools: [runStageTool] })
    await reg.invoke('run-stage', {
      entityId: entity.id,
      stageId: 4,
      variables: {
        prior: {
          3: { raw: { attributes: [{ key: 'culture.slang', value: 'stub-prior-marker', confidence: 0.5 }] } },
        },
      },
    })
    expect(sawPrior).toBe(true)
  })
})
