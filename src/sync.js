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


/** The party is a render-only spectator of the DM's authoritative state.
 *  Omit AI internals, projectile velocities and cooldowns the party never
 *  reads, and round positions before publishing to Realtime Database.
 *  The host keeps the full simulation in local memory. */
export function networkSnapshot(g) {
  const n = v => Math.round((Number(v)||0)*10)/10;
  return {
    version:g.version,status:g.status,time:n(g.time),winner:g.winner,
    elapsed:n(g.elapsed),threat:n(g.threat),towerHp:n(g.towerHp),towerMaxHp:g.towerMaxHp,
    stats:{...g.stats},log:g.log.slice(0,6),
    players:g.players.map(p=>({id:p.id,slot:p.slot,hero:p.hero,x:n(p.x),y:n(p.y),r:p.r,
      hp:n(p.hp),maxHp:p.maxHp,respawn:n(p.respawn),level:p.level,xp:n(p.xp),
      gold:p.gold,kills:p.kills,inventory:p.inventory})),
    enemies:g.enemies.map(e=>({id:e.id,kind:e.kind,x:n(e.x),y:n(e.y),r:e.r,
      hp:n(e.hp),maxHp:e.maxHp})),
    forts:g.forts.map(f=>({id:f.id,lane:f.lane,tier:f.tier,x:f.x,y:f.y,
      hp:n(f.hp),maxHp:f.maxHp,broken:f.broken,bossId:f.bossId})),
    chests:g.chests.map(c=>({id:c.id,x:c.x,y:c.y,opened:c.opened})),
    bullets:g.bullets.map(b=>({x:n(b.x),y:n(b.y),r:b.r,color:b.color})),
    effects:g.effects.map(e=>({x:n(e.x),y:n(e.y),type:e.type,ttl:n(e.ttl)})),
  };
}
