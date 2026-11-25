import sharp from 'sharp'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MIME_TO_FORMAT: Record<string, 'png' | 'jpeg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
}

export async function reportImagePng(dataUrl?: string | null): Promise<Buffer | null> {
  if (!dataUrl) return null
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) return null

  const input = Buffer.from(match[2], 'base64')
  if (!input.length || input.length > MAX_IMAGE_BYTES) return null

  try {
    const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata()
    if (metadata.format !== MIME_TO_FORMAT[match[1]]) return null
    return await sharp(input, { limitInputPixels: 40_000_000 }).png().toBuffer()
  } catch {
    return null
  }
}
