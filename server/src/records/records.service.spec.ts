import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import type { RecordAccessService } from './record-access.service'
import { RecordsService } from './records.service'
import type { RecyclingSyncService } from './recycling-sync.service'

describe('RecordsService', () => {
  it('delegates syncRecycling to RecyclingSyncService with the original arguments', async () => {
    const syncRecycling = vi.fn().mockResolvedValue(undefined)
    const service = new RecordsService(
      {} as PrismaService,
      {} as RecordAccessService,
      { syncRecycling } as unknown as RecyclingSyncService,
    )

    await expect(service.syncRecycling(42, [7, 8])).resolves.toBeUndefined()

    expect(syncRecycling).toHaveBeenCalledTimes(1)
    expect(syncRecycling).toHaveBeenCalledWith(42, [7, 8])
  })
})
