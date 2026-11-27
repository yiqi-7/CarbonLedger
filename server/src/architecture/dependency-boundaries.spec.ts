import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), '..')
const sharedSource = resolve(root, 'packages/shared/src')
const serverSource = resolve(root, 'server/src')
const webSource = resolve(root, 'web/src')

const forbiddenSharedPackages = /^(?:@nestjs|@prisma|vue|axios|express|jsdom|happy-dom|linkedom|domino)(?:\/|$)/
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue'])
const resolutionExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.vue', '/index.ts', '/index.js']

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return filesIn(path)
    return sourceExtensions.has(extname(entry.name)) ? [path] : []
  })
}

function sourceText(file: string): string {
  const text = readFileSync(file, 'utf8')
  if (extname(file) !== '.vue') return text
  return [...text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n')
}

function importsFrom(file: string): string[] {
  const source = sourceText(file)
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, extname(file) === '.ts' || extname(file) === '.tsx' ? ts.ScriptKind.TS : ts.ScriptKind.JS)
  const imports: string[] = []
  parsed.forEachChild(node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text)
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text)
  })
  return imports
}

function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(from), specifier)
  for (const extension of resolutionExtensions) {
    const candidate = `${base}${extension}`
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // Continue trying the supported source extensions.
    }
  }
  return null
}

function relativeSource(file: string): string {
  return relative(root, file).replaceAll('\\', '/')
}

describe('architecture dependency boundaries', () => {
  it('keeps the shared kernel free of server, web, and runtime dependencies', () => {
    const violations = filesIn(sharedSource).flatMap(file => importsFrom(file)
      .filter(specifier => forbiddenSharedPackages.test(specifier))
      .map(specifier => `${relativeSource(file)} -> ${specifier}`))
    expect(violations).toEqual([])
  })

  it('keeps web source independent from server and Prisma', () => {
    const violations = filesIn(webSource).flatMap(file => importsFrom(file).flatMap(specifier => {
      if (specifier.startsWith('@prisma')) return [`${relativeSource(file)} -> ${specifier}`]
      const resolved = resolveImport(file, specifier)
      return resolved && relativeSource(resolved).startsWith('server/src/')
        ? [`${relativeSource(file)} -> ${relativeSource(resolved)}`]
        : []
    }))
    expect(violations).toEqual([])
  })

  it('keeps controllers behind application services', () => {
    const violations = filesIn(serverSource)
      .filter(file => file.endsWith('.controller.ts'))
      .flatMap(file => importsFrom(file)
        .filter(specifier => specifier.includes('prisma') || specifier.includes('@prisma'))
        .map(specifier => `${relativeSource(file)} -> ${specifier}`))
    expect(violations).toEqual([])
  })

  it('ratchets records deep imports against the explicit baseline', () => {
    const baseline = new Set([
      'server/src/import-export/import-export.service.ts -> server/src/records/record-access.service.ts',
      'server/src/import-export/import-export.service.ts -> server/src/records/records.service.ts',
      'server/src/import-export/import-export.service.spec.ts -> server/src/records/record-access.service.ts',
      'server/src/import-export/import-export.service.spec.ts -> server/src/records/records.service.ts',
    ])
    const edges = new Set<string>()
    for (const file of filesIn(serverSource)) {
      if (relativeSource(file).startsWith('server/src/records/')) continue
      for (const specifier of importsFrom(file)) {
        const resolved = resolveImport(file, specifier)
        if (!resolved) continue
        const target = relativeSource(resolved)
        if (!target.startsWith('server/src/records/')) continue
        if (target.endsWith('/records.module.ts') || target.endsWith('/index.ts')) continue
        edges.add(`${relativeSource(file)} -> ${target}`)
      }
    }
    expect([...edges].sort()).toEqual([...baseline].sort())
  })
})
