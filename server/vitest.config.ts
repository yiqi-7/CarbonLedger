/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

/**
 * NestJS 依赖注入依赖 emitDecoratorMetadata，vitest 默认的 esbuild 不产出该元数据，
 * 因此使用 SWC 插件编译（与 NestJS CLI 的 swc 模式一致）。
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test-admin-password-only',
    },
  },
})