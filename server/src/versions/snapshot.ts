import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { SnapshotFactory } from './snapshot.factory'

/** Backward-compatible parser used by report generation and older callers. */
export function parseSnapshotOrThrow(serialized: string): CalcVersionSnapshot {
  return new SnapshotFactory().parse(serialized)
}
