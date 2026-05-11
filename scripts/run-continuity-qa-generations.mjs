/**
 * Queue the five continuity QA scene generations for an entity.
 *
 *   node scripts/run-continuity-qa-generations.mjs ruslan_levashov
 *   node scripts/run-continuity-qa-generations.mjs ruslan_levashov --dry-run
 */

import { createComfyService } from '../api/lib/comfy/comfyService.js'
import { runContinuityQaGenerations } from '../api/lib/continuity/continuityQaGeneration.js'
import { createVectorRuntime } from '../api/lib/vector/runtime.js'

const entityId = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!entityId) {
  console.error('Usage: node scripts/run-continuity-qa-generations.mjs <entityId> [--dry-run]')
  process.exit(1)
}

const runtime = createVectorRuntime({ env: process.env })
try {
  const comfyService = createComfyService({ env: process.env })
  const result = await runContinuityQaGenerations({
    db: runtime.db,
    entityId,
    comfyService,
    input: { queue: { dryRun } },
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  runtime.close()
}
