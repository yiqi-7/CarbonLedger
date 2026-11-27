<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

type Brand = {
  name: string
  seed: number
  scale: number
  ink: string
  detection: string
  path: string
}

type Target = {
  active: boolean
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  opacity: number
  targetOpacity: number
}

type PendingPointer = { clientX: number; clientY: number }

type FieldState = {
  brand: Brand
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  table: Float32Array
  field: Float32Array
  sat: Float32Array
  values: Float32Array
  offsetX: Float32Array
  offsetY: Float32Array
  velocityX: Float32Array
  velocityY: Float32Array
  targets: Target[]
  dpr: number
  width: number
  height: number
  plotX: number
  plotY: number
  plotWidth: number
  plotHeight: number
  cellWidth: number
  cellHeight: number
  elapsed: number
  pulse: number
  pointerInside: boolean
  overlayVisible: boolean
  pointerX: number
  pointerY: number
  lastImpulseX: number
  lastImpulseY: number
  pendingPointer: PendingPointer | null
  lastScan: number
  visible: boolean
  resizeObserver?: ResizeObserver
}

const props = defineProps<{ paused?: boolean }>()
const canvasRefs = ref<(HTMLCanvasElement | null)[]>([])
const fallback = ref(false)
const fallbackMessage = '当前浏览器不支持 Canvas 动态背景。'

const brands: Brand[] = [
  {
    name: 'Apple', seed: 3, scale: 0.82, ink: '#202220', detection: '#267dff',
    path: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
  },
  {
    name: 'Google', seed: 29, scale: 0.79, ink: '#2152e7', detection: '#91dcff',
    path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867.0.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
  {
    name: 'Tesla', seed: 51, scale: 0.81, ink: '#ec353e', detection: '#4eaeff',
    path: 'M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z',
  },
]

const sourceBrands = computed(() => brands)
const states: FieldState[] = []
let lattice: Float32Array | null = null
let frameId = 0
let singleFrameId = 0
let observer: IntersectionObserver | undefined
let visibilityHandler: (() => void) | undefined

function setCanvasRef(element: unknown, index: number) {
  canvasRefs.value[index] = element instanceof HTMLCanvasElement ? element : null
}

function createLattice() {
  const values = new Float32Array(128 * 128)
  let state = 7319 >>> 0
  for (let index = 0; index < values.length; index += 1) {
    state = (state ^ (state << 13)) >>> 0
    state = (state ^ (state >>> 17)) >>> 0
    state = (state ^ (state << 5)) >>> 0
    values[index] = (state / 4294967295) * 2 - 1
  }
  return values
}

function sourceTable(brand: Brand) {
  const scratch = document.createElement('canvas')
  scratch.width = 300
  scratch.height = 300
  const context = scratch.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D is unavailable.')
  context.fillStyle = '#000000'
  context.fillRect(0, 0, 300, 300)
  const scale = (300 / 24) * brand.scale
  context.save()
  context.setTransform(scale, 0, 0, scale, 150 - 12 * scale, 150 - 12 * scale)
  context.fillStyle = '#FFFFFF'
  context.fill(new Path2D(brand.path))
  context.restore()

  const pixels = context.getImageData(0, 0, 300, 300).data
  const table = new Float32Array(60 * 60)
  for (let row = 0; row < 60; row += 1) {
    for (let column = 0; column < 60; column += 1) {
      let total = 0
      for (let sourceRow = 0; sourceRow < 5; sourceRow += 1) {
        for (let sourceColumn = 0; sourceColumn < 5; sourceColumn += 1) {
          const pixel = ((row * 5 + sourceRow) * 300 + column * 5 + sourceColumn) * 4
          total += (0.2126 * pixels[pixel] + 0.7152 * pixels[pixel + 1] + 0.0722 * pixels[pixel + 2]) / 255
        }
      }
      table[row * 60 + column] = total / 25
    }
  }
  scratch.width = 0
  scratch.height = 0
  return table
}

function smooth(value: number) { return value * value * (3 - 2 * value) }
function latticeValue(x: number, y: number) {
  const currentLattice = lattice
  if (!currentLattice) return 0
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smooth(x - x0)
  const ty = smooth(y - y0)
  const at = (column: number, row: number) => currentLattice[((row & 127) * 128) + (column & 127)]
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

function quantize(value: number) {
  if (value < 0.12) return 0
  if (value < 0.42) return 1
  if (value < 0.89) return 2
  return 3
}

function makeTargets(): Target[] {
  return Array.from({ length: 3 }, () => ({ active: false, x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0, opacity: 0, targetOpacity: 0 }))
}

function resizeState(state: FieldState) {
  const bounds = state.canvas.getBoundingClientRect()
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const dpr = window.devicePixelRatio || 1
  state.width = width
  state.height = height
  state.dpr = dpr
  state.canvas.width = Math.max(1, Math.round(width * dpr))
  state.canvas.height = Math.max(1, Math.round(height * dpr))
  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const horizontalPadding = Math.max(12, width * 0.08)
  const verticalPadding = Math.max(18, height * 0.08)
  state.plotX = horizontalPadding
  state.plotY = verticalPadding
  state.plotWidth = Math.max(1, width - horizontalPadding * 2)
  state.plotHeight = Math.max(1, height - verticalPadding * 2)
  state.cellWidth = state.plotWidth / 60
  state.cellHeight = state.plotHeight / 60
}

function triggerImpulse(state: FieldState, x: number, y: number) {
  state.pulse = 1
  state.lastImpulseX = x
  state.lastImpulseY = y
}

function processPendingPointer(state: FieldState) {
  if (!state.pendingPointer) return
  const pending = state.pendingPointer
  state.pendingPointer = null
  const bounds = state.canvas.getBoundingClientRect()
  const x = pending.clientX - bounds.left
  const y = pending.clientY - bounds.top
  const moved = Math.hypot(x - state.lastImpulseX, y - state.lastImpulseY) > 1.5
  state.pointerX = x
  state.pointerY = y
  if (state.pointerInside && moved) triggerImpulse(state, x, y)
}

function queuePointer(event: PointerEvent, index: number) {
  const state = states[index]
  if (!state) return
  state.pendingPointer = { clientX: event.clientX, clientY: event.clientY }
  if (event.type === 'pointerenter') state.pointerInside = true
  if (event.type === 'pointerdown') {
    state.pointerInside = true
    state.overlayVisible = true
  }
  ensureSingleFrame()
}

function enterField(index: number) {
  const state = states[index]
  if (!state) return
  const bounds = state.canvas.getBoundingClientRect()
  state.pointerX = bounds.width / 2
  state.pointerY = bounds.height / 2
  state.lastImpulseX = state.pointerX
  state.lastImpulseY = state.pointerY
  state.pointerInside = true
  state.overlayVisible = true
  triggerImpulse(state, state.pointerX, state.pointerY)
  ensureSingleFrame()
}

function leaveField(index: number) {
  const state = states[index]
  if (!state) return
  state.pointerInside = false
  state.overlayVisible = false
  ensureSingleFrame()
}

function focusField(index: number) {
  const state = states[index]
  if (!state) return
  state.overlayVisible = true
  ensureSingleFrame()
}

function blurField(index: number) {
  const state = states[index]
  if (!state) return
  state.overlayVisible = false
  ensureSingleFrame()
}

function deposit(field: Float32Array, x: number, y: number, value: number) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const tx = x - left
  const ty = y - top
  for (let dy = 0; dy <= 1; dy += 1) {
    for (let dx = 0; dx <= 1; dx += 1) {
      const column = left + dx
      const row = top + dy
      if (column < 0 || column >= 60 || row < 0 || row >= 60) continue
      const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty)
      field[row * 60 + column] += value * weight
    }
  }
}

function areaSum(sat: Float32Array, left: number, top: number, size: number) {
  const right = left + size
  const bottom = top + size
  return sat[bottom * 61 + right] - sat[top * 61 + right] - sat[bottom * 61 + left] + sat[top * 61 + left]
}

function scanTargets(state: FieldState) {
  state.field.fill(0)
  for (let row = 0; row < 30; row += 1) {
    for (let column = 0; column < 60; column += 1) {
      const index = row * 60 + column
      const offsetX = state.offsetX[index] / Math.max(0.1, state.cellWidth)
      const offsetY = state.offsetY[index] / Math.max(0.1, state.cellHeight)
      const value = state.values[index]
      deposit(state.field, column + offsetX, row * 2 + offsetY, value * 0.5)
      deposit(state.field, column + offsetX, row * 2 + 1 + offsetY, value * 0.5)
    }
  }
  state.sat.fill(0)
  for (let row = 0; row < 60; row += 1) {
    let rowTotal = 0
    for (let column = 0; column < 60; column += 1) {
      rowTotal += state.field[row * 60 + column]
      state.sat[(row + 1) * 61 + column + 1] = state.sat[row * 61 + column + 1] + rowTotal
    }
  }

  const candidates: { x: number; y: number; score: number }[] = []
  let brightest = 0
  for (let row = 0; row <= 53; row += 1) {
    for (let column = 0; column <= 53; column += 1) {
      const score = areaSum(state.sat, column, row, 7) / 49
      if (score > brightest) brightest = score
      candidates.push({ x: column + 3, y: row + 3, score })
    }
  }
  if (brightest < 0.04) {
    for (const target of state.targets) target.targetOpacity = 0
    return
  }
  const previous = state.targets.filter(target => target.active && target.targetOpacity > 0)
  candidates.sort((a, b) => {
    const prior = (candidate: { x: number; y: number }) => previous.reduce((best, target) => Math.max(best, 0.025 * Math.exp(-((candidate.x - target.targetX) ** 2 + (candidate.y - target.targetY) ** 2) / 128)), 0)
    return (b.score + prior(b)) - (a.score + prior(a))
  })
  const selected: typeof candidates = []
  const threshold = brightest * 0.48
  for (const candidate of candidates) {
    if (candidate.score < threshold) break
    const spacing = selected.some(item => Math.hypot(item.x - candidate.x, item.y - candidate.y) < 16)
    if (!spacing) selected.push(candidate)
    if (selected.length === 3) break
  }
  if (selected.length < 2) {
    for (const candidate of candidates) {
      if (candidate.score < threshold) break
      if (!selected.some(item => Math.hypot(item.x - candidate.x, item.y - candidate.y) < 12)) selected.push(candidate)
      if (selected.length === 3) break
    }
  }

  const used = new Set<number>()
  for (const candidate of selected) {
    let slot = -1
    let distance = Infinity
    state.targets.forEach((target, index) => {
      if (used.has(index) || !target.active) return
      const nextDistance = Math.hypot(target.targetX - candidate.x, target.targetY - candidate.y)
      if (nextDistance <= 12 && nextDistance < distance) { slot = index; distance = nextDistance }
    })
    if (slot < 0) slot = state.targets.findIndex((target, index) => !used.has(index) && (!target.active || target.opacity < 0.04))
    if (slot < 0) continue
    const target = state.targets[slot]
    target.active = true
    target.targetX = candidate.x
    target.targetY = candidate.y
    target.targetOpacity = 1
    used.add(slot)
  }
  state.targets.forEach((target, index) => {
    if (!used.has(index)) target.targetOpacity = 0
  })
}

function updateTargets(state: FieldState, delta: number, immediate = false) {
  if (immediate) {
    state.targets.forEach(target => {
      target.x = target.targetX
      target.y = target.targetY
      target.vx = 0
      target.vy = 0
      target.opacity = target.targetOpacity
    })
    return
  }
  let remaining = delta
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 120)
    for (const target of state.targets) {
      const ax = (target.targetX - target.x) * 144 - target.vx * 24
      const ay = (target.targetY - target.y) * 144 - target.vy * 24
      target.vx += ax * step
      target.vy += ay * step
      target.x += target.vx * step
      target.y += target.vy * step
      target.opacity += (target.targetOpacity - target.opacity) * (1 - Math.exp(-step * 16))
      if (Math.abs(target.targetX - target.x) < 0.002 && Math.abs(target.vx) < 0.002) { target.x = target.targetX; target.vx = 0 }
      if (Math.abs(target.targetY - target.y) < 0.002 && Math.abs(target.vy) < 0.002) { target.y = target.targetY; target.vy = 0 }
      if (target.targetOpacity === 0 && target.opacity < 0.04) target.active = false
    }
    remaining -= step
  }
}

function drawHeaderMark(state: FieldState) {
  const path = new Path2D()
  for (let column = 0; column < 8; column += 1) {
    const value = state.table[column * 3]
    const height = 4 + value * 11
    path.moveTo(state.plotX + column * 4, state.plotY - 12)
    path.lineTo(state.plotX + column * 4, state.plotY - 12 + height)
  }
  state.ctx.save()
  state.ctx.strokeStyle = state.brand.ink
  state.ctx.globalAlpha = 0.36
  state.ctx.lineWidth = 1
  state.ctx.lineCap = 'butt'
  state.ctx.stroke(path)
  state.ctx.restore()
}

function drawCallouts(state: FieldState) {
  if (!state.overlayVisible) return
  const context = state.ctx
  context.save()
  context.lineWidth = 1
  context.font = '10px Arial, Helvetica, sans-serif'
  context.textBaseline = 'bottom'
  const active = state.targets.filter(target => target.active && target.opacity > 0.01)
  active.forEach((target, index) => {
    const x = state.plotX + target.x * state.cellWidth - state.cellWidth
    const y = state.plotY + target.y * state.cellHeight - state.cellHeight
    const width = state.cellWidth * 9
    const height = state.cellHeight * 9
    const alpha = Math.min(0.84, target.opacity)
    context.globalAlpha = alpha * 0.14
    context.fillStyle = state.brand.detection
    context.fillRect(x, y, width, height)
    context.globalAlpha = alpha
    context.strokeStyle = state.brand.detection
    context.strokeRect(x, y, width, height)
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(x, y + 8); context.lineTo(x, y); context.lineTo(x + 8, y)
    context.moveTo(x + width - 8, y); context.lineTo(x + width, y); context.lineTo(x + width, y + 8)
    context.moveTo(x, y + height - 8); context.lineTo(x, y + height); context.lineTo(x + 8, y + height)
    context.moveTo(x + width - 8, y + height); context.lineTo(x + width, y + height); context.lineTo(x + width, y + height - 8)
    context.stroke()
    const label = `${target.x.toFixed(1)} / ${target.y.toFixed(1)}`
    context.font = '10px Arial, Helvetica, sans-serif'
    context.fillStyle = state.brand.detection
    context.fillText(label, x, y - 4)
    if (index > 0) {
      const previous = active[index - 1]
      const previousX = state.plotX + previous.x * state.cellWidth + state.cellWidth * 3.5
      const previousY = state.plotY + previous.y * state.cellHeight + state.cellHeight * 3.5
      const currentX = x + width / 2
      const currentY = y + height / 2
      context.globalAlpha = Math.min(previous.opacity, target.opacity) * 0.42
      context.lineWidth = 1
      context.beginPath(); context.moveTo(previousX, previousY); context.lineTo(currentX, currentY); context.stroke()
    }
  })
  context.restore()
}

function drawState(state: FieldState, delta: number, now: number, immediate = false) {
  processPendingPointer(state)
  const context = state.ctx
  const currentDpr = window.devicePixelRatio || 1
  if (currentDpr !== state.dpr) resizeState(state)
  if (!immediate) {
    state.elapsed += delta
    state.pulse *= Math.exp(-delta * 5.5)
  }
  const groups = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
  const plotCell = Math.min(state.cellWidth, state.cellHeight)
  const radius = state.plotWidth * 0.25
  for (let row = 0; row < 30; row += 1) {
    for (let column = 0; column < 60; column += 1) {
      const index = row * 60 + column
      const source = (state.table[(row * 2) * 60 + column] + state.table[(row * 2 + 1) * 60 + column]) / 2
      const noise = latticeValue(column * 0.15 + state.brand.seed, row * 0.16 - state.elapsed * 0.17)
      const luminance = Math.max(0, Math.min(1, source * 0.94 + noise * 0.12 * (0.25 + source * 0.75)))
      state.values[index] = luminance
      const baseX = state.plotX + (column + 0.5) * state.cellWidth
      const baseY = state.plotY + (row * 2 + 0.18) * state.cellHeight
      const distance = Math.hypot(baseX - state.pointerX, baseY - state.pointerY)
      const influence = radius > 0 ? Math.max(0, 1 - distance / radius) ** 2 : 0
      const radialX = distance > 0 ? (baseX - state.pointerX) / distance : 0
      const radialY = distance > 0 ? (baseY - state.pointerY) / distance : 0
      const targetX = radialX * influence * state.pulse * 25
      const targetY = radialY * influence * state.pulse * 25 * 0.58
      const step = Math.min(delta, 1 / 30)
      const springX = (targetX - state.offsetX[index]) * 145 - state.velocityX[index] * 19
      const springY = (targetY - state.offsetY[index]) * 145 - state.velocityY[index] * 19
      if (!immediate) {
        state.velocityX[index] += springX * step
        state.velocityY[index] += springY * step
        state.offsetX[index] += state.velocityX[index] * step
        state.offsetY[index] += state.velocityY[index] * step
      } else {
        state.offsetX[index] = 0; state.offsetY[index] = 0; state.velocityX[index] = 0; state.velocityY[index] = 0
      }
      const level = quantize(luminance)
      const x = baseX + state.offsetX[index]
      const y = baseY + state.offsetY[index]
      groups[level].moveTo(x, y)
      groups[level].lineTo(x, y + state.cellHeight * 2 - 0.7)
    }
  }
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
  context.clearRect(0, 0, state.width, state.height)
  const widths = [0.38, 1.12, 2.28, 3.8]
  const opacities = [0.15, 0.64, 0.93, 1]
  context.lineCap = 'butt'
  groups.forEach((path, level) => {
    context.save()
    context.strokeStyle = state.brand.ink
    context.globalAlpha = opacities[level]
    context.lineWidth = widths[level] * plotCell / 5.25
    context.stroke(path)
    context.restore()
  })
  drawHeaderMark(state)
  if (state.overlayVisible && (now - state.lastScan > 100 || immediate)) {
    scanTargets(state)
    state.lastScan = now
  }
  updateTargets(state, delta, immediate)
  drawCallouts(state)
}

function drawStatic() {
  const now = performance.now()
  states.forEach(state => drawState(state, 0, now, true))
}

function ensureSingleFrame() {
  if (singleFrameId || frameId) return
  singleFrameId = requestAnimationFrame(() => {
    singleFrameId = 0
    states.forEach(state => drawState(state, 0, performance.now(), true))
  })
}

function stopAnimation() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
}

function hasVisibleState() { return states.some(state => state.visible) }
function animate(now: number) {
  frameId = 0
  if (props.paused || document.hidden || !hasVisibleState()) return
  const previous = Number((animate as unknown as { previous?: number }).previous || now)
  const delta = Math.min(1 / 30, Math.max(0, (now - previous) / 1000))
  ;(animate as unknown as { previous?: number }).previous = now
  states.forEach(state => { if (state.visible) drawState(state, delta, now) })
  frameId = requestAnimationFrame(animate)
}
function startAnimation() {
  stopAnimation()
  ;(animate as unknown as { previous?: number }).previous = undefined
  if (!props.paused && !document.hidden && hasVisibleState()) frameId = requestAnimationFrame(animate)
  else drawStatic()
}

function observeVisibility() {
  if (!observer) return
  canvasRefs.value.forEach(canvas => { if (canvas) observer?.observe(canvas) })
}

function initialize() {
  try {
    states.length = 0
    if (typeof Path2D === 'undefined' || !document.createElement('canvas').getContext) throw new Error('Canvas 2D is unavailable.')
    lattice = createLattice()
    brands.forEach((brand, index) => {
      const canvas = canvasRefs.value[index]
      const context = canvas?.getContext('2d')
      if (!canvas || !context) throw new Error('Canvas 2D is unavailable.')
      const state: FieldState = {
        brand, canvas, ctx: context, table: sourceTable(brand), field: new Float32Array(3600), sat: new Float32Array(61 * 61), values: new Float32Array(1800), offsetX: new Float32Array(1800), offsetY: new Float32Array(1800), velocityX: new Float32Array(1800), velocityY: new Float32Array(1800), targets: makeTargets(), dpr: 1, width: 1, height: 1, plotX: 0, plotY: 0, plotWidth: 1, plotHeight: 1, cellWidth: 1, cellHeight: 1, elapsed: 0, pulse: 0, pointerInside: false, overlayVisible: false, pointerX: 0, pointerY: 0, lastImpulseX: -999, lastImpulseY: -999, pendingPointer: null, lastScan: -Infinity, visible: true,
      }
      resizeState(state)
      state.resizeObserver = new ResizeObserver(() => { resizeState(state); ensureSingleFrame() })
      state.resizeObserver.observe(canvas)
      states.push(state)
    })
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const state = states.find(item => item.canvas === entry.target)
        if (state) state.visible = entry.isIntersecting
      })
      startAnimation()
    }, { threshold: 0.01 })
    observeVisibility()
    startAnimation()
  } catch {
    fallback.value = true
  }
}

watch(() => props.paused, () => {
  if (props.paused) { stopAnimation(); drawStatic() } else startAnimation()
})

onMounted(async () => {
  await nextTick()
  visibilityHandler = () => {
    if (document.hidden) stopAnimation()
    else startAnimation()
  }
  document.addEventListener('visibilitychange', visibilityHandler)
  initialize()
})

onUnmounted(() => {
  stopAnimation()
  if (singleFrameId) cancelAnimationFrame(singleFrameId)
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  observer?.disconnect()
  states.forEach(state => state.resizeObserver?.disconnect())
})
</script>

<template>
  <div class="line-field-background" :class="{ 'line-field-fallback': fallback }" aria-label="动态线条背景">
    <template v-if="!fallback">
      <div
        v-for="(brand, index) in sourceBrands"
        :key="brand.name"
        class="line-field-panel"
        tabindex="0"
        :aria-label="`${brand.name} 线条识别背景`"
        @pointerenter="enterField(index)"
        @pointerleave="leaveField(index)"
        @pointermove="queuePointer($event, index)"
        @pointerdown="queuePointer($event, index)"
        @focus="focusField(index)"
        @blur="blurField(index)"
      >
        <canvas :ref="element => setCanvasRef(element, index)" aria-hidden="true" />
        <span class="line-field-panel-label" aria-hidden="true">{{ index + 1 }} / {{ brand.name }}</span>
      </div>
    </template>
    <p v-else>{{ fallbackMessage }}</p>
  </div>
</template>

<style scoped>
.line-field-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(12px, 2.4vw, 30px);
  width: min(100%, 1480px);
  height: min(78vh, 760px);
  margin: auto;
  padding: clamp(10px, 2.4vw, 32px);
  pointer-events: auto;
  opacity: 0.62;
}
.line-field-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(37, 65, 74, 0.08);
  border-radius: 20px;
  outline: none;
  overflow: visible;
  background: rgba(255, 255, 255, 0.12);
  transition: border-color 180ms ease, background-color 180ms ease;
}
.line-field-panel:hover,
.line-field-panel:focus-visible {
  border-color: rgba(0, 113, 227, 0.28);
  background: rgba(255, 255, 255, 0.24);
}
.line-field-panel:focus-visible { outline: 2px solid rgba(0, 113, 227, 0.52); outline-offset: 4px; }
.line-field-panel canvas { display: block; width: 100%; height: 100%; }
.line-field-panel-label {
  position: absolute;
  top: 12px;
  left: 14px;
  color: rgba(32, 41, 41, 0.44);
  font: 600 10px/1 Arial, Helvetica, sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  pointer-events: none;
}
.line-field-fallback {
  place-items: center;
  height: auto;
  color: #6E6E73;
  font: 13px/1.5 Arial, Helvetica, sans-serif;
  pointer-events: none;
}
.line-field-fallback p { margin: 0; }
@media (max-width: 700px) {
  .line-field-background {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    width: min(100%, 520px);
    height: min(74vh, 720px);
    gap: 12px;
    padding: 14px;
    opacity: 0.42;
  }
  .line-field-panel { border-radius: 16px; }
  .line-field-panel-label { top: 9px; left: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .line-field-panel { transition: none; }
}
</style>
