#!/usr/bin/env node
// Background poller — triggers the API route on a timer so history is
// captured even when no browser tab is open.
//
// Run alongside the dev server:
//   npm run dev:all
// Or separately:
//   node scripts/poller.mjs

const INTERVAL_MS = Math.max(5, parseInt(process.env.POLL_INTERVAL_SECS ?? '10')) * 1000
const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000'

async function poll() {
  try {
    const res = await fetch(`${BASE_URL}/api/aircraft`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const { aircraft } = await res.json()
      const count = (aircraft ?? []).length
      process.stdout.write(
        `\r[poller] ${new Date().toLocaleTimeString()}  ${String(count).padStart(3)} aircraft   `,
      )
    } else {
      process.stderr.write(`\n[poller] HTTP ${res.status}\n`)
    }
  } catch (err) {
    const e = /** @type {Error} */ (err)
    if (e.name === 'AbortError' || /** @type {any} */ (e).code === 'ECONNREFUSED') {
      process.stdout.write(`\r[poller] waiting for Next.js to start…          `)
    } else {
      process.stderr.write(`\n[poller] error: ${e.message}\n`)
    }
  }
}

console.log(`[poller] Polling ${BASE_URL}/api/aircraft every ${INTERVAL_MS / 1000}s`)
poll()
setInterval(poll, INTERVAL_MS)
