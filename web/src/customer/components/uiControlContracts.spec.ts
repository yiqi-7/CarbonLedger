import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(file: string) {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
}

describe('shared control template contracts', () => {
  it('keeps sidebar navigation, exit, toggle, and accessible state wiring', () => {
    const template = source('./AppSidebar.vue')
    expect(template).toContain("@click.prevent=\"emit('navigate', '首页')\"")
    expect(template).toContain("@click=\"emit('navigate', item)\"")
    expect(template).toContain("@click.prevent=\"emit('exit')\"")
    expect(template).toContain("@click=\"emit('toggle')\"")
    expect(template).toContain(":aria-current=\"activePage === item ? 'page' : undefined\"")
    expect(template).toContain(":aria-label=\"collapsed ? '展开导航栏' : '隐藏导航栏'\"")
  })

  it('keeps notification wired while documenting search and organization as presentational controls', () => {
    const template = source('./TopHeader.vue')
    expect(template).toContain('aria-label="搜索"')
    expect(template).toContain('aria-label="通知" @click="emit(\'notification\')"')
    expect(template).toContain('class="organization-switcher"')
    expect(template).not.toContain('@click="emit(\'search\')"')
    expect(template).not.toContain('@click="emit(\'organization\')"')
  })
})
