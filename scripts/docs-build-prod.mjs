/**
 * Production docs build: omit draft Lab pages (docs/lab) and hide Lab from nav.
 * Local draft preview: npm run docs:dev (LAB_PAGES unset → Lab included).
 *
 * Uses a temp rename so VitePress never sees docs/lab during `vitepress build`.
 */
import { execSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const labDir = join(root, 'docs/lab')
const stashDir = join(root, '.lab-draft-stash')

if (existsSync(stashDir)) {
  console.error(
    '[docs-build-prod] Remove stale stash: .lab-draft-stash (previous build may have failed mid-run)'
  )
  process.exit(1)
}

const env = { ...process.env, LAB_PAGES: '0' }

if (!existsSync(labDir)) {
  console.warn('[docs-build-prod] docs/lab missing — building without lab stash step')
  execSync('npx vitepress build docs', { stdio: 'inherit', cwd: root, env })
  process.exit(0)
}

renameSync(labDir, stashDir)
try {
  execSync('npx vitepress build docs', { stdio: 'inherit', cwd: root, env })
} catch {
  process.exitCode = 1
} finally {
  if (existsSync(stashDir)) {
    renameSync(stashDir, labDir)
  }
}

process.exit(process.exitCode ?? 0)
