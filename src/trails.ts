// Trails: spots monsters leave on the floor with some floor abilities (MONSTER_ABILITIES), and
// what they do to players standing on them. Positions are in world units.
import { MONSTER_ABILITIES, TRAIL_RADIUS } from './config';
import type { Player } from './player';

export type TrailKind = 'wood' | 'ice' | 'lava';

export interface TrailSpot {
  x: number;
  y: number;
  kind: TrailKind;
  age: number; // seconds since it was dropped
}

let spots: TrailSpot[] = [];

export function isTrailKind(floor: string): floor is TrailKind {
  return floor === 'wood' || floor === 'ice' || floor === 'lava';
}

export function dropTrail(x: number, y: number, kind: TrailKind): void {
  spots.push({ x, y, kind, age: 0 });
}

export function updateTrails(dt: number): void {
  for (const s of spots) s.age += dt;
  spots = spots.filter((s) => s.age < MONSTER_ABILITIES[s.kind].lasts);
}

export function clearTrails(): void {
  spots = [];
}

export function trailSpots(): readonly TrailSpot[] {
  return spots;
}

// What the trail spots under a player do to it this step: spores slow it down, ice makes it
// slide, fire burns lives. A hopping player is above the trail and isn't touched.
export function applyTrails(p: Player): void {
  if (p.z > 0) return;
  for (const s of spots) {
    if (Math.hypot(s.x - p.x, s.y - p.y) > TRAIL_RADIUS + p.radius * 0.5) continue;
    if (s.kind === 'wood') p.slowedBy = MONSTER_ABILITIES.wood.slowDown;
    if (s.kind === 'ice') p.slipGrip = MONSTER_ABILITIES.ice.grip;
    if (s.kind === 'lava') p.hurt(MONSTER_ABILITIES.lava.livesLost);
  }
}
