/**
 * Liquid Glass real-time optical refraction engine.
 *
 * Implements Snell's-law edge refraction with an analytic rounded-rectangle
 * signed distance field (SDF), a flat zero-displacement optical center,
 * bounded bezel curvature, subtle chromatic micro-dispersion, and pointer-driven
 * directional edge glint.
 *
 * Optical references (MIT License):
 * - rdev/liquid-glass-react (ac48eab18d1f7f444ae30002d240cae29c863a21)
 * - 9und30/glassy-liquid (2361eb1f03979703db988180028ccc6d5fc23fe5)
 * - shuding/liquid-glass (a2d2e847f793430e3409a52927af815a23f4d372)
 *
 * Chromium renders live SVG backdrop displacement via `backdrop-filter: url(#...)`.
 * Safari, Firefox, and `prefers-reduced-transparency: reduce` environments
 * automatically fall back to the matched frosted-glass surface with specular glint.
 */

export interface OpticalProfile {
  id: string
  width: number
  height: number
  radius: number
  bezelWidth: number
  ior: number
  maxDisplacement: number
  dispersion: number
}

export interface DisplacementSample {
  dx: number
  dy: number
  edgeWeight: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const CONTAINER_ID = 'carbon-liquid-glass-optics'

const DEFAULT_PROFILES: OpticalProfile[] = [
  {
    id: 'lg-bar-refract',
    width: 320,
    height: 72,
    radius: 36,
    bezelWidth: 18,
    ior: 1.48,
    maxDisplacement: 10,
    dispersion: 0.035,
  },
  {
    id: 'lg-pill-refract',
    width: 180,
    height: 48,
    radius: 24,
    bezelWidth: 14,
    ior: 1.46,
    maxDisplacement: 7,
    dispersion: 0.03,
  },
  {
    id: 'lg-panel-refract',
    width: 240,
    height: 240,
    radius: 28,
    bezelWidth: 22,
    ior: 1.48,
    maxDisplacement: 11,
    dispersion: 0.03,
  },
]

const INTERACTIVE_GLASS_SELECTOR = [
  '.topbar',
  '.top-header',
  '.sidebar',
  '.el-button',
  '.button',
  '.nav-item',
  '.material-search',
  '.material-filters button',
  '.filter-pills button',
  '.stage-switch button',
  '.factor-tabs button',
  '.cost-chart-tabs button',
  '.project-directory-link',
  '.back-button',
  '.sidebar-toggle',
  '.login-card',
  '.register-form',
].join(', ')

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Analytic signed distance and outward unit normal for a centered rounded box.
 * Negative distance = inside the box; 0 = perimeter.
 */
function roundedRectSdfAndNormal(
  px: number,
  py: number,
  halfW: number,
  halfH: number,
  radius: number,
): { dist: number; nx: number; ny: number } {
  const r = Math.min(radius, halfW, halfH)
  const bx = Math.max(0, halfW - r)
  const by = Math.max(0, halfH - r)
  const qx = Math.abs(px) - bx
  const qy = Math.abs(py) - by
  const sx = px < 0 ? -1 : 1
  const sy = py < 0 ? -1 : 1

  const outX = Math.max(qx, 0)
  const outY = Math.max(qy, 0)
  const outLen = Math.hypot(outX, outY)

  if (outLen > 0) {
    return {
      dist: outLen - r,
      nx: (outX / outLen) * sx,
      ny: (outY / outLen) * sy,
    }
  }

  if (qx > qy) {
    return { dist: qx - r, nx: sx, ny: 0 }
  }
  return { dist: qy - r, nx: 0, ny: sy }
}

/**
 * Computes normalized Snell refraction displacement (-1..1) at pixel (x, y).
 * Keeps the center completely flat (dx = 0, dy = 0) and concentrates
 * curvature within `bezelWidth` pixels of the boundary.
 */
export function computeRoundedRectDisplacement(
  x: number,
  y: number,
  profile: OpticalProfile,
): DisplacementSample {
  const halfW = profile.width / 2
  const halfH = profile.height / 2
  const px = x - halfW
  const py = y - halfH

  const { dist, nx, ny } = roundedRectSdfAndNormal(px, py, halfW, halfH, profile.radius)
  const depthInside = -dist

  if (depthInside <= 0 || depthInside >= profile.bezelWidth) {
    return { dx: 0, dy: 0, edgeWeight: 0 }
  }

  const t = clamp(depthInside / profile.bezelWidth, 0, 1)
  const oneMinusT = 1 - t
  const slope = oneMinusT * oneMinusT * (1.35 - 0.35 * t)

  const sinI = clamp(slope, 0, 0.92)
  const cosI = Math.sqrt(Math.max(0.0001, 1 - sinI * sinI))
  const sinT = clamp(sinI / profile.ior, 0, 0.92)
  const cosT = Math.sqrt(Math.max(0.0001, 1 - sinT * sinT))
  const bend = clamp((sinI * cosT - cosI * sinT) / cosT, 0, 1)

  const magnitude = clamp(bend * 1.45, 0, 1)
  return {
    dx: -nx * magnitude,
    dy: -ny * magnitude,
    edgeWeight: oneMinusT,
  }
}

function buildDisplacementDataUrl(profile: OpticalProfile): string | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = profile.width
  canvas.height = profile.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const image = ctx.createImageData(profile.width, profile.height)
  const data = image.data

  for (let y = 0; y < profile.height; y += 1) {
    for (let x = 0; x < profile.width; x += 1) {
      const { dx, dy } = computeRoundedRectDisplacement(x + 0.5, y + 0.5, profile)
      const idx = (y * profile.width + x) * 4
      data[idx] = Math.round(clamp(128 + dx * 127, 0, 255))
      data[idx + 1] = Math.round(clamp(128 + dy * 127, 0, 255))
      data[idx + 2] = 128
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

export function supportsSvgBackdropRefraction(
  userAgent?: string,
  reducedTransparency?: boolean,
): boolean {
  if (reducedTransparency) return false
  if (typeof window === 'undefined' && userAgent === undefined) return false

  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const isChromium =
    /(Chrome|Chromium|Edg|OPR)\/\d+/i.test(ua) &&
    !/Firefox|FxiOS/i.test(ua) &&
    !(/Safari/i.test(ua) && !/(Chrome|Chromium|Edg|OPR)/i.test(ua))

  if (!isChromium) return false

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      return false
    }
  }

  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('backdrop-filter', 'blur(2px)')
  }

  return true
}

function createFilterElement(doc: Document, profile: OpticalProfile, mapUrl: string): SVGFilterElement {
  const filter = doc.createElementNS(SVG_NS, 'filter')
  filter.setAttribute('id', profile.id)
  filter.setAttribute('x', '0%')
  filter.setAttribute('y', '0%')
  filter.setAttribute('width', '100%')
  filter.setAttribute('height', '100%')
  filter.setAttribute('color-interpolation-filters', 'sRGB')

  const feImage = doc.createElementNS(SVG_NS, 'feImage')
  feImage.setAttribute('href', mapUrl)
  feImage.setAttributeNS(XLINK_NS, 'xlink:href', mapUrl)
  feImage.setAttribute('x', '0')
  feImage.setAttribute('y', '0')
  feImage.setAttribute('width', '100%')
  feImage.setAttribute('height', '100%')
  feImage.setAttribute('preserveAspectRatio', 'none')
  feImage.setAttribute('result', 'lg-map')
  filter.appendChild(feImage)

  const channels: Array<{ key: string; scale: number; matrix: string }> = [
    {
      key: 'r',
      scale: profile.maxDisplacement * (1 + profile.dispersion),
      matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
    },
    {
      key: 'g',
      scale: profile.maxDisplacement,
      matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
    },
    {
      key: 'b',
      scale: profile.maxDisplacement * (1 - profile.dispersion),
      matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
    },
  ]

  for (const ch of channels) {
    const disp = doc.createElementNS(SVG_NS, 'feDisplacementMap')
    disp.setAttribute('in', 'SourceGraphic')
    disp.setAttribute('in2', 'lg-map')
    disp.setAttribute('scale', ch.scale.toFixed(2))
    disp.setAttribute('xChannelSelector', 'R')
    disp.setAttribute('yChannelSelector', 'G')
    disp.setAttribute('result', `disp-${ch.key}`)
    filter.appendChild(disp)

    const mat = doc.createElementNS(SVG_NS, 'feColorMatrix')
    mat.setAttribute('in', `disp-${ch.key}`)
    mat.setAttribute('type', 'matrix')
    mat.setAttribute('values', ch.matrix)
    mat.setAttribute('result', `ch-${ch.key}`)
    filter.appendChild(mat)
  }

  const blendRG = doc.createElementNS(SVG_NS, 'feBlend')
  blendRG.setAttribute('in', 'ch-r')
  blendRG.setAttribute('in2', 'ch-g')
  blendRG.setAttribute('mode', 'screen')
  blendRG.setAttribute('result', 'ch-rg')
  filter.appendChild(blendRG)

  const blendRGB = doc.createElementNS(SVG_NS, 'feBlend')
  blendRGB.setAttribute('in', 'ch-rg')
  blendRGB.setAttribute('in2', 'ch-b')
  blendRGB.setAttribute('mode', 'screen')
  blendRGB.setAttribute('result', 'refracted')
  filter.appendChild(blendRGB)

  const softBlur = doc.createElementNS(SVG_NS, 'feGaussianBlur')
  softBlur.setAttribute('in', 'refracted')
  softBlur.setAttribute('stdDeviation', '0.35')
  filter.appendChild(softBlur)

  return filter
}

function mountOpticsSvg(doc: Document): boolean {
  if (doc.getElementById(CONTAINER_ID)) return true

  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('id', CONTAINER_ID)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.style.position = 'fixed'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.style.pointerEvents = 'none'
  svg.style.overflow = 'hidden'

  const defs = doc.createElementNS(SVG_NS, 'defs')
  let mountedCount = 0

  for (const profile of DEFAULT_PROFILES) {
    const mapUrl = buildDisplacementDataUrl(profile)
    if (!mapUrl) continue
    defs.appendChild(createFilterElement(doc, profile, mapUrl))
    mountedCount += 1
  }

  if (mountedCount === 0) return false
  svg.appendChild(defs)
  ;(doc.body || doc.documentElement).appendChild(svg)
  return true
}

function attachPointerGlint(doc: Document): () => void {
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) return () => {}

  let activeTarget: HTMLElement | null = null
  let dragOriginX = 0
  let dragging = false

  const onPointerMove = (event: PointerEvent) => {
    const raw = event.target
    if (!(raw instanceof Element)) return
    const target = raw.closest<HTMLElement>(INTERACTIVE_GLASS_SELECTOR)
    if (target) {
      const rect = target.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
        const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
        target.style.setProperty('--lg-glint-x', `${px.toFixed(1)}%`)
        target.style.setProperty('--lg-glint-y', `${py.toFixed(1)}%`)
      }
    }

    if (dragging && activeTarget) {
      const delta = clamp((event.clientX - dragOriginX) / 140, -1, 1)
      const stretchX = (0.965 + Math.abs(delta) * 0.055).toFixed(3)
      const stretchY = (0.96 - Math.abs(delta) * 0.025).toFixed(3)
      const shiftX = (delta * 3.5).toFixed(1)
      activeTarget.style.setProperty('--lg-drag-sx', stretchX)
      activeTarget.style.setProperty('--lg-drag-sy', stretchY)
      activeTarget.style.setProperty('--lg-drag-tx', `${shiftX}px`)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const raw = event.target
    if (!(raw instanceof Element)) return
    const target = raw.closest<HTMLElement>(
      '.el-button, .button, .nav-item, .material-filters button, .filter-pills button, .stage-switch button, .factor-tabs button, .cost-chart-tabs button, .project-directory-link, .back-button, .sidebar-toggle',
    )
    if (!target || (target as HTMLButtonElement).disabled) return
    activeTarget = target
    dragOriginX = event.clientX
    dragging = true
    target.dataset.lgPressed = 'true'
  }

  const clearPress = () => {
    if (!activeTarget) return
    const el = activeTarget
    activeTarget = null
    dragging = false
    delete el.dataset.lgPressed
    el.style.removeProperty('--lg-drag-sx')
    el.style.removeProperty('--lg-drag-sy')
    el.style.removeProperty('--lg-drag-tx')
  }

  doc.addEventListener('pointermove', onPointerMove, { passive: true })
  doc.addEventListener('pointerdown', onPointerDown, { passive: true })
  doc.addEventListener('pointerup', clearPress, { passive: true })
  doc.addEventListener('pointercancel', clearPress, { passive: true })
  window.addEventListener('blur', clearPress, { passive: true })

  return () => {
    doc.removeEventListener('pointermove', onPointerMove)
    doc.removeEventListener('pointerdown', onPointerDown)
    doc.removeEventListener('pointerup', clearPress)
    doc.removeEventListener('pointercancel', clearPress)
    window.removeEventListener('blur', clearPress)
  }
}

let initialized = false

export function initLiquidGlass(): 'optical' | 'frosted' {
  if (typeof document === 'undefined') return 'frosted'
  const root = document.documentElement

  const applyMode = (): 'optical' | 'frosted' => {
    const canRefract = supportsSvgBackdropRefraction() && mountOpticsSvg(document)
    const mode = canRefract ? 'optical' : 'frosted'
    root.dataset.liquidGlass = mode
    return mode
  }

  const mode = applyMode()

  if (!initialized) {
    initialized = true
    attachPointerGlint(document)
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-reduced-transparency: reduce)')
      const onChange = () => applyMode()
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
      }
    }
  }

  return mode
}
