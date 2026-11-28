import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_BUDGET = {
  maxTotalBytes: 3_500_000,
  maxAssetBytes: 1_000_000,
  checkedExtensions: ['.js', '.css'],
}

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    const relativePath = path.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath))
    } else if (entry.isFile()) {
      const { size } = await stat(absolutePath)
      files.push({ path: relativePath, size })
    }
  }

  return files
}

export function evaluateBundle(files, budget = DEFAULT_BUDGET) {
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const checkedExtensions = new Set(budget.checkedExtensions)
  const oversizedAssets = files.filter(file => {
    const extension = path.extname(file.path).toLowerCase()
    return checkedExtensions.has(extension) && file.size > budget.maxAssetBytes
  })

  return {
    totalBytes,
    totalWithinBudget: totalBytes <= budget.maxTotalBytes,
    oversizedAssets,
    passed: totalBytes <= budget.maxTotalBytes && oversizedAssets.length === 0,
  }
}

export async function checkBundleSize({ distDirectory, budget = DEFAULT_BUDGET } = {}) {
  const files = await collectFiles(distDirectory)
  return { files, ...evaluateBundle(files, budget) }
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer budget, received: ${value}`)
  }
  return parsed
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

async function main() {
  const distArgumentIndex = process.argv.indexOf('--dist')
  const distDirectory = distArgumentIndex >= 0
    ? process.argv[distArgumentIndex + 1]
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist')
  if (!distDirectory || distDirectory.startsWith('--')) {
    throw new Error('--dist requires a directory path')
  }

  const budget = {
    ...DEFAULT_BUDGET,
    maxTotalBytes: parsePositiveInteger(process.env.WEB_DIST_MAX_TOTAL_BYTES, DEFAULT_BUDGET.maxTotalBytes),
    maxAssetBytes: parsePositiveInteger(process.env.WEB_DIST_MAX_ASSET_BYTES, DEFAULT_BUDGET.maxAssetBytes),
  }
  const result = await checkBundleSize({ distDirectory, budget })

  console.log(`web/dist total: ${formatKiB(result.totalBytes)} / ${formatKiB(budget.maxTotalBytes)}`)
  for (const file of result.files.toSorted((left, right) => right.size - left.size).slice(0, 5)) {
    console.log(`  ${formatKiB(file.size)}  ${file.path}`)
  }

  if (!result.passed) {
    if (!result.totalWithinBudget) {
      console.error(`Bundle total exceeds the ${formatKiB(budget.maxTotalBytes)} budget.`)
    }
    for (const asset of result.oversizedAssets) {
      console.error(`${asset.path} exceeds the ${formatKiB(budget.maxAssetBytes)} per-asset budget (${formatKiB(asset.size)}).`)
    }
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
