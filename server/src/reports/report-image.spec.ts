import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { reportImagePng } from './report-image'

async function dataUrl(format: 'png' | 'jpeg' | 'webp'): Promise<string> {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#287a54' } })
    .toFormat(format)
    .toBuffer()
  const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
  return `data:${mime};base64,${bytes.toString('base64')}`
}

describe('report image conversion', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('normalizes %s to PNG', async format => {
    const result = await reportImagePng(await dataUrl(format))
    expect(result).not.toBeNull()
    expect(result?.subarray(1, 4).toString()).toBe('PNG')
  })

  it('rejects invalid, mismatched, and over-size image payloads', async () => {
    const validPng = await dataUrl('png')
    expect(await reportImagePng('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull()
    expect(await reportImagePng(validPng.replace('image/png', 'image/jpeg'))).toBeNull()
    expect(await reportImagePng('data:image/png;base64,not-an-image')).toBeNull()
    const oversized = `data:image/png;base64,${Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')}`
    expect(await reportImagePng(oversized)).toBeNull()
  })
})
