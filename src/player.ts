import {
  ARENA,
  FIRST_PERSON,
  GRAVITY,
  HOP_SPEED,
  LIVES,
  PLAYER_GRIP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  type PlayerConfig,
  type PowerName,
} from './config';
import { isDown, wasPressed } from './input';
import { pushOutOfWalls } from './maze';
import { playSound } from './sound';

export class Player {
  x: number;
  y: number;
  z = 0; // height above the floor, for hopping
  vx = 0;
  vy = 0;
  vz = 0;
  radius = PLAYER_RADIUS;
  lives = LIVES.start;
  safeFor = 0; // seconds left in which monsters can't hurt this player
  respawnIn = 0; // seconds left until a player with 0 lives comes back
  // Set by monster trails for the next step only (see trails.ts): speed multiplier and grip.
  slowedBy = 1;
  slipGrip: number | null = null;
  lastLivesLost = 0; // how many lives the last hurt took, for the "-3" shown above the player
  bonusTimer = 0; // seconds toward the next bonus life (LIVES.bonusEvery)
  bonusShownFor = 0; // seconds left to show the "+1" above the player after a bonus life
  facing = 0; // the way it last walked, in radians (0 = right): fireballs fly this way
  cooldowns: Record<PowerName, number> = { lightning: 0, fire: 0, ice: 0 }; // seconds until each power works again

  // emoji: this round's look, from PLAYER_LOOKS.
  constructor(
    public config: PlayerConfig,
    public emoji: string,
  ) {
    this.x = config.start.x * ARENA.width;
    this.y = config.start.y * ARENA.height;
  }

  // firstPerson: up/down walk forward/back the way the player faces, left/right turn it.
  // Seen from above, the arrow or WASD keys move it in that direction on the screen.
  update(dt: number, firstPerson: boolean): void {
    if (this.isDead()) {
      this.respawnIn = Math.max(0, this.respawnIn - dt);
      return;
    }
    this.safeFor = Math.max(0, this.safeFor - dt);
    this.bonusShownFor = Math.max(0, this.bonusShownFor - dt);
    // A bonus life every LIVES.bonusEvery seconds, but never more than LIVES.start.
    this.bonusTimer += dt;
    if (this.bonusTimer >= LIVES.bonusEvery) {
      this.bonusTimer -= LIVES.bonusEvery;
      if (this.lives < LIVES.start) {
        this.lives += 1;
        this.bonusShownFor = 1;
        playSound('bonusLife');
      }
    }
    const c = this.config.controls;
    const sideways = (isDown(c.right) ? 1 : 0) - (isDown(c.left) ? 1 : 0);
    const ahead = (isDown(c.up) ? 1 : 0) - (isDown(c.down) ? 1 : 0);
    let ix: number;
    let iy: number;
    if (firstPerson) {
      this.facing += sideways * FIRST_PERSON.turnSpeed * dt;
      ix = Math.cos(this.facing) * ahead;
      iy = Math.sin(this.facing) * ahead;
    } else {
      ix = sideways;
      iy = -ahead;
      // Diagonals shouldn't be faster than straight lines.
      const len = Math.hypot(ix, iy);
      if (len > 0) {
        ix /= len;
        iy /= len;
        this.facing = Math.atan2(iy, ix);
      }
    }
    for (const power of Object.keys(this.cooldowns) as PowerName[]) {
      this.cooldowns[power] = Math.max(0, this.cooldowns[power] - dt);
    }

    // Ease velocity toward the target instead of snapping to it.
    const blend = Math.min(1, (this.slipGrip ?? PLAYER_GRIP) * dt);
    const speed = PLAYER_SPEED * this.slowedBy;
    this.vx += (ix * speed - this.vx) * blend;
    this.vy += (iy * speed - this.vy) * blend;
    this.slowedBy = 1;
    this.slipGrip = null;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Action button: a hop for now. Swap this for shooting, dashing, etc.
    if (wasPressed(c.action) && this.z === 0) {
      this.vz = HOP_SPEED;
      playSound('hop');
    }
    this.vz -= GRAVITY * dt;
    this.z = Math.max(0, this.z + this.vz * dt);
    if (this.z === 0) this.vz = 0;

    this.stayInArena();
  }

  // A monster or its fire trail hurt this player: lose lives, then be safe for a moment so it
  // can get away.
  hurt(livesLost: number): void {
    if (this.safeFor > 0) return;
    this.lives = Math.max(0, this.lives - livesLost);
    this.lastLivesLost = livesLost;
    this.safeFor = LIVES.safeTime;
    if (this.isDead()) this.respawnIn = LIVES.respawnTime;
    playSound(this.isDead() ? 'out' : 'hurt');
  }

  isDead(): boolean {
    return this.lives === 0;
  }

  // Come back at (x, y) with full lives, safe from monsters for a moment.
  respawn(x: number, y: number): void {
    this.lives = LIVES.start;
    this.safeFor = LIVES.safeTime;
    playSound('comeback');
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
  }

  stayInArena(): void {
    const r = this.radius;
    this.x = Math.min(Math.max(this.x, r), ARENA.width - r);
    this.y = Math.min(Math.max(this.y, r), ARENA.height - r);
    pushOutOfWalls(this);
    this.x = Math.min(Math.max(this.x, r), ARENA.width - r);
    this.y = Math.min(Math.max(this.y, r), ARENA.height - r);
  }
}

// On one shared screen, players can't run farther apart than the camera can show at once
// (max, in world units). Past that, the player running away pulls the other one along.
export function keepTogether(a: Player, b: Player, max: { width: number; height: number }): void {
  const pullX = Math.max(0, Math.abs(b.x - a.x) - max.width) / 2;
  const pullY = Math.max(0, Math.abs(b.y - a.y) - max.height) / 2;
  if (pullX === 0 && pullY === 0) return;
  const dirX = Math.sign(b.x - a.x);
  const dirY = Math.sign(b.y - a.y);
  a.x += dirX * pullX;
  a.y += dirY * pullY;
  b.x -= dirX * pullX;
  b.y -= dirY * pullY;
  a.stayInArena();
  b.stayInArena();
}

// Anything round that stands in the arena and can be bumped: players and the monster.
export interface Body {
  x: number;
  y: number;
  z: number;
  radius: number;
  stayInArena(): void;
}

// Push two overlapping bodies apart so they can bump but not overlap.
export function separate(a: Body, b: Body): void {
  if (a.z > a.radius || b.z > b.radius) return; // one is jumping over the other
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const overlap = a.radius + b.radius - dist;
  if (overlap <= 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;
  a.stayInArena();
  b.stayInArena();
}
