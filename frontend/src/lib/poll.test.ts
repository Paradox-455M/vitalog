import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollWithBackoff } from './poll'

describe('pollWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when fn returns true on first call', async () => {
    const fn = vi.fn().mockResolvedValue(true)
    const controller = new AbortController()

    const promise = pollWithBackoff(fn, controller.signal, { initial: 2000 })

    // advance past the initial delay
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls fn repeatedly until it returns true', async () => {
    let callCount = 0
    const fn = vi.fn().mockImplementation(async () => {
      callCount++
      return callCount >= 3
    })
    const controller = new AbortController()

    const promise = pollWithBackoff(fn, controller.signal, { initial: 2000, factor: 1.5, max: 30000 })

    // First interval
    await vi.advanceTimersByTimeAsync(2000)
    // Second interval (2000 * 1.5 = 3000 with jitter; advance generously)
    await vi.advanceTimersByTimeAsync(4000)
    // Third interval
    await vi.advanceTimersByTimeAsync(6000)
    await promise

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('rejects with AbortError when signal is aborted mid-poll', async () => {
    const fn = vi.fn().mockResolvedValue(false)
    const controller = new AbortController()

    const promise = pollWithBackoff(fn, controller.signal, { initial: 2000 })

    // Abort before the first timer fires
    controller.abort()

    // The promise should reject with an AbortError (signal fired before the first wait resolved)
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('stops polling when signal is aborted after first successful wait', async () => {
    let callCount = 0
    const controller = new AbortController()
    const fn = vi.fn().mockImplementation(async () => {
      callCount++
      // After fn is called, abort so next cycle does not run
      if (callCount === 1) controller.abort()
      return false
    })

    const promise = pollWithBackoff(fn, controller.signal, { initial: 2000 })

    await vi.advanceTimersByTimeAsync(2000)
    await promise

    // fn was called once; abort stops further polling
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('stops polling when fn throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'))
    const controller = new AbortController()

    const promise = pollWithBackoff(fn, controller.signal, { initial: 2000 })

    await vi.advanceTimersByTimeAsync(2000)
    await promise

    // Should have been called once and then stopped (catch breaks loop)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects the max delay cap', async () => {
    // Verify the delay grows but never exceeds max
    // We track when fn is actually called to infer timing
    const calls: number[] = []
    const fn = vi.fn().mockImplementation(async () => {
      calls.push(Date.now())
      return calls.length >= 5
    })
    const controller = new AbortController()

    const promise = pollWithBackoff(fn, controller.signal, {
      initial: 1000,
      factor: 10, // aggressive factor to hit max quickly
      max: 3000,
    })

    // Advance enough time for 5 calls (1000 + 3000 + 3000 + 3000 + 3000 = 13000)
    await vi.advanceTimersByTimeAsync(15000)
    await promise

    expect(fn).toHaveBeenCalledTimes(5)
  })
})
