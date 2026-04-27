import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const modelsPath = path.join(root, 'src-tauri', 'resources', 'models.json')
const checksumsPath = path.join(root, 'src-tauri', 'bin', 'CHECKSUMS.txt')
const binaries = [
  'llama-server-x86_64-pc-windows-msvc.exe',
  'llama-server-x86_64-apple-darwin',
  'llama-server-aarch64-apple-darwin',
  'llama-server-x86_64-unknown-linux-gnu',
]

function fail(message) {
  console.error(`embedded-preflight: ${message}`)
  process.exit(1)
}

if (!existsSync(modelsPath)) fail('missing models.json')
if (!existsSync(checksumsPath)) fail('missing CHECKSUMS.txt')

const models = JSON.parse(readFileSync(modelsPath, 'utf8'))
for (const model of models) {
  const sha = String(model.sha256 || '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    fail(`invalid sha256 for model ${model.id}`)
  }
}

const checksums = readFileSync(checksumsPath, 'utf8')
if (checksums.includes('REPLACE_ME')) {
  fail('CHECKSUMS.txt contains REPLACE_ME placeholder')
}
for (const bin of binaries) {
  const binPath = path.join(root, 'src-tauri', 'bin', bin)
  if (!existsSync(binPath)) fail(`missing sidecar binary: ${bin}`)
  const content = readFileSync(binPath, 'utf8')
  if (content.includes('PLACEHOLDER_BINARY_REPLACE_BEFORE_RELEASE')) {
    fail(`placeholder sidecar binary detected: ${bin}`)
  }
}

console.log('embedded-preflight: ok')
