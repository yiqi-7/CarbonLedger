import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { connect } from 'node:net'

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173/')
const apiUrl = process.env.SMOKE_API_URL ? new URL(process.env.SMOKE_API_URL) : undefined
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000)
const skipCdp = process.env.SMOKE_SKIP_CDP === '1'

function fail(message) {
  throw new Error(message)
}

function withPath(base, pathname) {
  return new URL(pathname.replace(/^\//, ''), base).toString()
}

async function fetchText(url, expectedStatus = 200) {
  let response
  try {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    fail(`HTTP request failed for ${url}: ${error.message}`)
  }
  const body = await response.text()
  if (response.status !== expectedStatus) {
    fail(`Expected ${expectedStatus} from ${url}, received ${response.status}`)
  }
  return { response, body }
}

async function checkHttpSurface() {
  const pages = ['/', '/customer.html', '/design-preview.html']
  const pageBodies = new Map()
  for (const page of pages) {
    const { response, body } = await fetchText(withPath(baseUrl, page))
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) fail(`${page} did not return HTML (${contentType || 'missing content-type'})`)
    if (!body.includes('<div id="app"></div>')) fail(`${page} is missing the Vue mount point`)
    pageBodies.set(page, body)
  }

  const rootBody = pageBodies.get('/')
  const scriptMatch = rootBody.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)
  if (!scriptMatch) fail('Root HTML has no module script')
  const scriptUrl = new URL(scriptMatch[1], baseUrl)
  const { response: scriptResponse } = await fetchText(scriptUrl)
  const scriptType = scriptResponse.headers.get('content-type') ?? ''
  if (!scriptType.includes('javascript') && !scriptType.includes('text/plain')) {
    fail(`Root module script returned unexpected content type: ${scriptType || 'missing content-type'}`)
  }

  if (apiUrl) {
    const healthUrl = new URL('health', apiUrl).toString()
    const { body } = await fetchText(healthUrl)
    let health
    try {
      health = JSON.parse(body)
    } catch {
      fail(`${healthUrl} did not return JSON`)
    }
    if (health.status !== 'ok' || health.service !== 'carbon-ledger-api') {
      fail(`${healthUrl} returned an unexpected health payload`)
    }
    console.log(`HTTP API smoke passed: ${healthUrl}`)
  }

  console.log(`HTTP smoke passed: ${pages.join(', ')} and ${scriptUrl.pathname}`)
  return rootBody
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', windowsHide: true })
  return result.status === 0
}

function findChrome() {
  if (process.env.SMOKE_CHROME_PATH) return process.env.SMOKE_CHROME_PATH
  const candidates = [
    process.env.CHROME_PATH,
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      if (candidate && commandExists(candidate)) return candidate
    } catch {
      // Continue through the platform candidates.
    }
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    if (commandExists(command)) return command
  }
  fail('No Chrome/Chromium executable found. Set SMOKE_CHROME_PATH or run with SMOKE_SKIP_CDP=1 for HTTP-only smoke.')
}

function waitForOutput(child, pattern, timeout = timeoutMs) {
  return new Promise((resolve, reject) => {
    let output = ''
    let timer
    const onData = (chunk) => {
      output += chunk.toString()
      const match = output.match(pattern)
      if (!match) return
      clearTimeout(timer)
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onData)
      resolve(match[1])
    }
    const onExit = (code) => {
      clearTimeout(timer)
      reject(new Error(`Chrome exited before CDP became ready (code ${code}). Output: ${output}`))
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('exit', onExit)
    timer = setTimeout(() => {
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onData)
      child.off('exit', onExit)
      reject(new Error(`Timed out waiting for Chrome CDP endpoint. Output: ${output}`))
    }, timeout)
  })
}

class CdpSocket {
  constructor(socket) {
    this.socket = socket
    this.buffer = Buffer.alloc(0)
    this.handshakeDone = false
    this.messages = []
    this.waiters = []
    this.pending = new Map()
    this.nextId = 1
    socket.on('data', (chunk) => this.onData(chunk))
    socket.on('error', (error) => this.rejectAll(error))
    socket.on('close', () => this.rejectAll(new Error('CDP socket closed')))
  }

  static async open(webSocketUrl) {
    const url = new URL(webSocketUrl)
    const socket = connect(Number(url.port || 80), url.hostname)
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    const client = new CdpSocket(socket)
    const key = randomBytes(16).toString('base64')
    socket.write(
      `GET ${url.pathname}${url.search} HTTP/1.1\r\n` +
      `Host: ${url.host}\r\n` +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Key: ${key}\r\n` +
      'Sec-WebSocket-Version: 13\r\n\r\n',
    )
    await client.waitForHandshake()
    return client
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    if (!this.handshakeDone) {
      const end = this.buffer.indexOf('\r\n\r\n')
      if (end === -1) return
      const headers = this.buffer.subarray(0, end).toString()
      if (!headers.startsWith('HTTP/1.1 101')) {
        this.rejectAll(new Error(`CDP WebSocket handshake failed: ${headers.split('\r\n')[0]}`))
        return
      }
      this.handshakeDone = true
      this.buffer = this.buffer.subarray(end + 4)
      this.handshakeWaiter?.resolve()
      this.handshakeWaiter = undefined
    }
    this.consumeFrames()
  }

  consumeFrames() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0]
      const second = this.buffer[1]
      const opcode = first & 0x0f
      const masked = (second & 0x80) !== 0
      let offset = 2
      let length = second & 0x7f
      if (length === 126) {
        if (this.buffer.length < 4) return
        length = this.buffer.readUInt16BE(2)
        offset = 4
      } else if (length === 127) {
        if (this.buffer.length < 10) return
        const largeLength = this.buffer.readBigUInt64BE(2)
        if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('CDP frame is too large')
        length = Number(largeLength)
        offset = 10
      }
      const maskOffset = masked ? 4 : 0
      if (this.buffer.length < offset + maskOffset + length) return
      const mask = masked ? this.buffer.subarray(offset, offset + 4) : undefined
      const payloadOffset = offset + maskOffset
      const payload = Buffer.from(this.buffer.subarray(payloadOffset, payloadOffset + length))
      if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4]
      this.buffer = this.buffer.subarray(payloadOffset + length)
      if (opcode === 0x1) this.receiveMessage(payload.toString())
      else if (opcode === 0x8) this.rejectAll(new Error('CDP sent a close frame'))
      else if (opcode === 0x9) this.sendFrame(0xA, payload)
    }
  }

  receiveMessage(text) {
    let message
    try {
      message = JSON.parse(text)
    } catch {
      return
    }
    if (message.id && this.pending.has(message.id)) {
      const { resolve } = this.pending.get(message.id)
      this.pending.delete(message.id)
      resolve(message)
      return
    }
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve(message)
    else this.messages.push(message)
  }

  waitForHandshake() {
    if (this.handshakeDone) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.handshakeWaiter = { resolve, reject }
    })
  }

  sendFrame(opcode, payload) {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    const mask = randomBytes(4)
    const maskedBody = Buffer.from(body)
    for (let index = 0; index < maskedBody.length; index += 1) maskedBody[index] ^= mask[index % 4]
    let header
    if (body.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | body.length])
    else if (body.length <= 0xffff) {
      header = Buffer.alloc(4)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 126
      header.writeUInt16BE(body.length, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(body.length), 2)
    }
    this.socket.write(Buffer.concat([header, mask, maskedBody]))
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.sendFrame(0x1, JSON.stringify(payload))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for CDP command ${method}`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (message) => { clearTimeout(timer); resolve(message) },
        reject: (error) => { clearTimeout(timer); reject(error) },
      })
    })
  }

  nextEvent(predicate) {
    const existingIndex = this.messages.findIndex(predicate)
    if (existingIndex >= 0) return Promise.resolve(this.messages.splice(existingIndex, 1)[0])
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter.resolve === resolve)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(new Error('Timed out waiting for CDP event'))
      }, timeoutMs)
      this.waiters.push({ resolve: (message) => { clearTimeout(timer); if (predicate(message)) resolve(message); else this.nextEvent(predicate).then(resolve, reject) }, reject })
    })
  }

  rejectAll(error) {
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
    for (const waiter of this.waiters) waiter.reject(error)
    this.waiters = []
    this.handshakeWaiter?.reject(error)
  }

  close() {
    this.socket.end()
  }
}

async function smokeWithCdp() {
  const chrome = findChrome()
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'carbonledger-smoke-'))
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let socket
  try {
    const webSocketUrl = await waitForOutput(child, /DevTools listening on (ws:\/\/[^\s]+)/)
    socket = await CdpSocket.open(webSocketUrl)
    const created = await socket.send('Target.createTarget', { url: 'about:blank' })
    const targetId = created.result?.targetId
    if (!targetId) fail('CDP did not create a browser target')
    const attached = await socket.send('Target.attachToTarget', { targetId, flatten: true })
    const sessionId = attached.result?.sessionId
    if (!sessionId) fail('CDP did not attach to the browser target')
    await socket.send('Page.enable', {}, sessionId)
    await socket.send('Runtime.enable', {}, sessionId)
    await socket.send('Page.navigate', { url: baseUrl.toString() }, sessionId)
    await socket.nextEvent((message) => message.method === 'Page.loadEventFired' && message.sessionId === sessionId)

    let mounted = false
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const evaluated = await socket.send('Runtime.evaluate', {
        expression: `(() => ({ title: document.title, mounted: Boolean(document.querySelector('#app')?.children.length), text: document.body?.innerText?.slice(0, 200) ?? '' }))()`,
        returnByValue: true,
      }, sessionId)
      const value = evaluated.result?.result?.value
      if (value?.mounted) {
        if (!value.title) fail('Browser smoke page has no document title')
        mounted = true
        console.log(`CDP smoke passed: ${baseUrl} mounted ${value.title}`)
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!mounted) fail('CDP smoke timed out waiting for the Vue app to mount')
  } finally {
    socket?.close()
    if (child.exitCode === null) {
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
    }
    await rm(userDataDir, { recursive: true, force: true })
  }
}

async function main() {
  await checkHttpSurface()
  if (skipCdp) {
    console.log('CDP smoke skipped because SMOKE_SKIP_CDP=1')
    return
  }
  await smokeWithCdp()
}

main().catch((error) => {
  console.error(`Production smoke failed: ${error.message}`)
  process.exitCode = 1
})
