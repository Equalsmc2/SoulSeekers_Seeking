/** Only one Firebase write may be in flight for each data stream. Newer
 *  snapshots supersede queued older ones; sender never queues unbounded work.
 *  This is a transport optimization, not an authoritative server. */
export function makeLatestOnlySender(write, onError = () => {}) {
  let latest = null, busy = false, closed = false;
  let writes = 0, replacements = 0;
  async function drain() {
    if (busy || closed) return;
    busy = true;
    try {
      while (!closed && latest !== null) {
        const item = latest;
        latest = null;
        try { await write(item); writes++; }
        catch (error) { onError(error); }
      }
    } finally { busy = false; }
  }
  return {
    queue(item) {
      if (closed) return;
      if (latest !== null) replacements++;
      latest = item;
      void drain();
    },
    close() { closed = true; latest = null; },
    stats() { return { busy, queued: latest !== null, writes, replacements }; }
  };
}

/** Compute catch-up substeps for background-host tabs. An inactive browser may
 *  clamp timers; preserve up to one second of elapsed simulation per pulse. */
export function simulationSteps(elapsedSeconds) {
  const elapsed = Math.min(1, Math.max(0, Number(elapsedSeconds) || 0));
  const count = Math.max(1, Math.ceil(elapsed / 0.055));
  return { count, dt: elapsed / count };
}
