import { BadRequestException } from '@nestjs/common'
import type { CalcVersionSnapshot } from '@carbonledger/shared'

export function parseSnapshotOrThrow(serialized: string): CalcVersionSnapshot {
  try {
    const snapshot = JSON.parse(serialized) as Partial<CalcVersionSnapshot>
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.summary || !snapshot.project) {
      throw new Error('invalid snapshot shape')
    }
    return snapshot as CalcVersionSnapshot
  } catch {
    throw new BadRequestException('核算版本快照损坏，无法读取')
  }
}
