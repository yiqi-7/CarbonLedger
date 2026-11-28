import { describe, expect, it, vi } from 'vitest'
import { startAuthenticatedCustomerApp } from './authenticatedEntry.js'

function createContext(token) {
  return {
    apiClient: { get: vi.fn() },
    mount: vi.fn(),
    storage: { getItem: vi.fn(() => token) },
    location: { replace: vi.fn() },
  }
}

describe('authenticated customer entry', () => {
  it('redirects to login without a stored token and never mounts the workspace', async () => {
    const context = createContext(null)

    await expect(startAuthenticatedCustomerApp(context)).resolves.toBe(false)

    expect(context.apiClient.get).not.toHaveBeenCalled()
    expect(context.mount).not.toHaveBeenCalled()
    expect(context.location.replace).toHaveBeenCalledWith('/login')
  })

  it('validates the session with the API before mounting the workspace', async () => {
    const context = createContext('valid-token')
    context.apiClient.get.mockResolvedValue({ data: { id: 7 } })

    await expect(startAuthenticatedCustomerApp(context)).resolves.toBe(true)

    expect(context.apiClient.get).toHaveBeenCalledWith('/auth/me')
    expect(context.mount).toHaveBeenCalledOnce()
    expect(context.location.replace).not.toHaveBeenCalled()
  })

  it('redirects expired sessions to login without mounting', async () => {
    const context = createContext('expired-token')
    context.apiClient.get.mockRejectedValue({ response: { status: 401 } })

    await expect(startAuthenticatedCustomerApp(context)).resolves.toBe(false)

    expect(context.mount).not.toHaveBeenCalled()
    expect(context.location.replace).toHaveBeenCalledWith('/login')
  })

  it('keeps the workspace hidden and surfaces non-authentication failures', async () => {
    const context = createContext('valid-token')
    const failure = new Error('network unavailable')
    context.apiClient.get.mockRejectedValue(failure)

    await expect(startAuthenticatedCustomerApp(context)).rejects.toBe(failure)

    expect(context.mount).not.toHaveBeenCalled()
    expect(context.location.replace).not.toHaveBeenCalled()
  })
})
