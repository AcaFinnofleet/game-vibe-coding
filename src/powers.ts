// The players' powers against monsters (POWERS in config.ts): ⚡ lightning, 🔥 fire, ❄️ ice.
// Positions are in world units.
import { POWERS, type PowerName } from './config';
import { wallHit } from './maze';
import type { Monster } from './monster';
import type { Player } from './player';
import { playSound } from './sound';

export interface Fireball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
}

// Short-lived pictures of a power going off, for render.ts.
export interface Flash {
  kind: 'lightning' | 'ice';
  fromX: number; // lightning: from the player to the monster. ice: the middle of the ring.
  fromY: number;
  toX: number;
  toY: number;
  age: number;
}
export const FLASH_TIME = 0.35; // seconds a flash is shown

let fireballs: Fireball[] = [];
let flashes: Flash[] = [];

export function clearPowers(): void {
  fireballs = [];
  flashes = [];
}

export function allFireballs(): readonly Fireball[] {
  return fireballs;
}

export function allFlashes(): readonly Flash[] {
  return flashes;
}

// Use the powers whose keys the player pressed this step, if they have cooled down.
// Lightning with no monster in range strikes the floor just ahead instead, so the player sees the
// key works, and doesn't need to cool down.
export function usePowers(p: Player, monsters: Monster[], pressed: (key: string) => boolean): void {
  const c = p.config.controls;
  const ready = (power: PowerName, key: string) => pressed(key) && p.cooldowns[power] === 0;

  if (ready('lightning', c.lightning)) {
    const target = nearestZappable(p, monsters);
    if (target) {
      target.stunnedFor = POWERS.lightning.stun;
      flashes.push({ kind: 'lightning', fromX: p.x, fromY: p.y, toX: target.x, toY: target.y, age: 0 });
      p.cooldowns.lightning = POWERS.lightning.cooldown;
      playSound('lightning');
    } else {
      const missX = p.x + Math.cos(p.facing) * POWERS.lightning.missLength;
      const missY = p.y + Math.sin(p.facing) * POWERS.lightning.missLength;
      flashes.push({ kind: 'lightning', fromX: p.x, fromY: p.y, toX: missX, toY: missY, age: 0 });
      playSound('lightningMiss');
    }
  }

  if (ready('fire', c.fire)) {
    const speed = POWERS.fire.speed;
    fireballs.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.facing) * speed,
      vy: Math.sin(p.facing) * speed,
      traveled: 0,
    });
    p.cooldowns.fire = POWERS.fire.cooldown;
    playSound('fire');
  }

  if (ready('ice', c.ice)) {
    for (const m of monsters) {
      if (!m.isGone() && Math.hypot(m.x - p.x, m.y - p.y) <= POWERS.ice.radius + m.radius) {
        m.frozenFor = POWERS.ice.freeze;
      }
    }
    flashes.push({ kind: 'ice', fromX: p.x, fromY: p.y, toX: p.x, toY: p.y, age: 0 });
    p.cooldowns.ice = POWERS.ice.cooldown;
    playSound('ice');
  }
}

// The nearest monster within lightning range. Lightning jumps over walls.
function nearestZappable(p: Player, monsters: Monster[]): Monster | null {
  let best: Monster | null = null;
  let bestDist = POWERS.lightning.range;
  for (const m of monsters) {
    if (m.isGone()) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d <= bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

// Move fireballs and age flashes. A fireball that hits a monster burns it up; a wall or the end
// of its range makes it go out.
export function updatePowers(dt: number, monsters: Monster[]): void {
  for (const f of flashes) f.age += dt;
  flashes = flashes.filter((f) => f.age < FLASH_TIME);

  fireballs = fireballs.filter((f) => {
    const nx = f.x + f.vx * dt;
    const ny = f.y + f.vy * dt;
    if (wallHit(f.x, f.y, nx, ny) < 1) return false;
    f.x = nx;
    f.y = ny;
    f.traveled += Math.hypot(f.vx, f.vy) * dt;
    if (f.traveled > POWERS.fire.range) return false;
    const hit = monsters.find((m) => !m.isGone() && Math.hypot(m.x - f.x, m.y - f.y) <= m.radius + POWERS.fire.radius);
    if (!hit) return true;
    hit.hitByFire();
    return false;
  });
}
