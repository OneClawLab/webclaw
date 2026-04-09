/**
 * Unit tests: XgwClient pure logic (backoff, queue, state machine)
 * No WebSocket connections, no Electron.
 */
import { describe, it, expect } from 'vitest'
import { calcBackoffDelay } from '../../src/node/xgw/client.js'

describe('calcBackoffDelay', () => {
  it('attempt 1 → 1000ms', () => {
    expect(calcBackoffDelay(1)).toBe(1000)
  })

  it('attempt 2 → 2000ms', () => {
    expect(calcBackoffDelay(2)).toBe(2000)
  })

  it('attempt 3 → 4000ms', () => {
    expect(calcBackoffDelay(3)).toBe(4000)
  })

  it('caps at 60000ms', () => {
    expect(calcBackoffDelay(100)).toBe(60_000)
  })

  it('is monotonically increasing up to cap', () => {
    const delays = [1, 2, 3, 4, 5, 6].map(calcBackoffDelay)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!)
    }
  })
})
