interface PollOptions {
  initial?: number
  max?: number
  factor?: number
}

export async function pollWithBackoff(
  fn: () => Promise<boolean>,
  signal: AbortSignal,
  opts: PollOptions = {},
): Promise<void> {
  const { initial = 2000, max = 30_000, factor = 1.5 } = opts
  let delay = initial

  while (!signal.aborted) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })

    if (signal.aborted) break

    let done = false
    try {
      done = await fn()
    } catch {
      break
    }

    if (done) break
    delay = Math.min(delay * factor, max)
  }
}
