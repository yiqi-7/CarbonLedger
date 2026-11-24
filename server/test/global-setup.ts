import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** 端到端测试全局准备：重建独立测试库并推入 Prisma schema */
export default function setup(): void {
  const dbPath = join(process.cwd(), 'prisma', 'test.db')
  if (existsSync(dbPath)) rmSync(dbPath)

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--force-reset'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )
  if (result.status !== 0) {
    throw new Error('测试数据库初始化失败（prisma db push）')
  }
}