import { describe, it, expect } from 'vitest';
import CuePool from '@/models/DMX/cue.pool.model';

describe('CuePool#genCueId', () => {
  // Regression: genCueId read `this.chases` — a property CuePool does not
  // have (copy-paste from ChasePool.genChaseId) — so any addRaw/addCue call
  // without an explicit id threw "Cannot read properties of undefined
  // (reading 'reduce')". The UI never tripped it because every call site
  // precomputes an id; the MCP bridge's create_scene/create_effect will not.
  it('returns 0 for an empty pool instead of throwing', () => {
    const pool = new CuePool();
    expect(pool.genCueId()).toBe(0);
  });

  it('derives the next id from existing cues', () => {
    const pool = new CuePool();
    pool.cues.push({ id: 0 }, { id: 4 });
    expect(pool.genCueId()).toBe(5);
  });
});
