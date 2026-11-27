import { describe, expect, it, vi } from 'vitest'
import type { ProjectsService } from '../projects/projects.service'
import { RecordAccessService } from './record-access.service'

describe('RecordAccessService', () => {
  it('asserts project ownership once and forwards the project and user IDs', async () => {
    const assertOwner = vi.fn().mockResolvedValue(undefined)
    const service = new RecordAccessService({ assertOwner } as unknown as ProjectsService)

    await service.assertOwner(42, 7)

    expect(assertOwner).toHaveBeenCalledTimes(1)
    expect(assertOwner).toHaveBeenCalledWith(42, 7)
  })

  it('passes through a rejected ownership error unchanged', async () => {
    const error = new Error('ownership rejected')
    const assertOwner = vi.fn().mockRejectedValue(error)
    const service = new RecordAccessService({ assertOwner } as unknown as ProjectsService)

    await expect(service.assertOwner(42, 7)).rejects.toBe(error)
    expect(assertOwner).toHaveBeenCalledTimes(1)
    expect(assertOwner).toHaveBeenCalledWith(42, 7)
  })
})
