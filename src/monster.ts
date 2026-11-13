import {
  ARENA,
  type FloorName,
  MONSTER,
  MONSTER_ABILITIES,
  MONSTER_KINDS,
  type MonsterKind,
  PLAYER_SPEED,
  POWERS,
} from './config';
import { addBlock, type Cell, cellCenter, cellOf, nextStep, openNeighbors, pushOutOfWalls, wallHit } from './maze';
import type { Player } from './player';
import { playSound } from './sound';
import { dropTrail, isTrailKind } from './trails';

// The angle from a to b, between -PI and PI.
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

// How many monsters of each kind make up total monsters, following each kind's share.
// Leftovers after rounding down go to the kinds that lost the most by rounding.
function countsPerKind(total: number): { kind: MonsterKind; count: number }[] {
  const kinds = Object.values(MONSTER_KINDS);
  const shares = kinds.reduce((sum, k) => sum + k.share, 0);
  const counts = kinds.map((kind) => {
    const exact = (total * kind.share) / shares;
    return { kind, count: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = total - counts.reduce((sum, c) => sum + c.count, 0);
  for (const c of [...counts].sort((a, b) => b.rest - a.rest)) {
    if (left === 0) break;
    c.count++;
    left--;
  }
  return counts;
}

// Put total monsters in random places in the labyrinth, each in the middle of its own path cell
// and at least MONSTER.startDistance away from every player.
export function spawnMonsters(players: Player[], total: number): Monster[] {
  const monsters: Monster[] = [];
  for (const { kind, count } of countsPerKind(total)) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < 1000; tries++) {
      const spot = randomCellCenter();
      const taken = monsters.some((m) => m.x === spot.x && m.y === spot.y);
      if (nearAPlayer(spot, players) || taken) continue;
      monsters.push(new Monster(kind, spot.x, spot.y));
      placed++;
    }
  }
  return monsters;
}

function nearAPlayer(spot: { x: number; y: number }, players: Player[]): boolean {
  return players.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < MONSTER.startDistance);
}

function randomCellCenter(): { x: number; y: number } {
  return cellCenter(cellOf(Math.random() * ARENA.width, Math.random() * ARENA.height));
}

export class Monster {
  z = 0; // height above the floor: only above 0 during a knight jump
  radius: number;
  // Floor abilities (MONSTER_ABILITIES).
  beaming = false; // true while its tractor beam pulls the player it chases
  glitchFlash = 0; // seconds left of the flicker after a glitch
  private abilityTimer = 0; // seconds since it last used a timed ability
  private turboLeft = 0; // seconds of turbo left
  private dropTimer = 0; // seconds since it last dropped a trail spot
  private jump: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null = null;
  // Players' powers (POWERS).
  stunnedFor = 0; // seconds left of a ⚡ zap: it can't move or hurt
  frozenFor = 0; // seconds left of ❄️ ice: it can't move or hurt
  goneFor = 0; // seconds until a monster burned by 🔥 comes back; it isn't in the game meanwhile
  lives = MONSTER.lives; // 🔥 fireballs take one each
  hitFlash = 0; // seconds left of the flicker after a fireball hit
  facing = Math.random() * Math.PI * 2; // where its eyes look, in radians (0 = right)
  target: Player | null = null; // the player it chases, or null while wandering
  private lastSeen = { x: 0, y: 0 }; // where it last saw the player it chases
  private unseenFor = 0; // seconds since it last saw that player
  private wanderCell: Cell | null = null; // the cell it is walking to while wandering
  private cameFrom: Cell | null = null; // so it doesn't turn straight back while wandering
  private floatTo: { x: number; y: number } | null = null; // where a ghost drifts to while wandering

  constructor(
    public kind: MonsterKind,
    public x: number,
    public y: number,
  ) {
    this.radius = kind.radius;
  }

  // players: the players it can chase. Players with 0 lives are left out.
  // floor: the floor picked right now, which decides the monster's ability.
  update(dt: number, players: Player[], floor: FloorName): void {
    this.glitchFlash = Math.max(0, this.glitchFlash - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.beaming = false; // only on again if useAbility still pulls this step
    if (this.goneFor > 0) {
      this.goneFor = Math.max(0, this.goneFor - dt);
      if (this.goneFor === 0) this.comeBack(players);
      return;
    }
    if (this.stunnedFor > 0 || this.frozenFor > 0) {
      this.stunnedFor = Math.max(0, this.stunnedFor - dt);
      this.frozenFor = Math.max(0, this.frozenFor - dt);
      return;
    }
    if (this.jump) {
      this.updateJump(dt);
      return;
    }
    if (this.target && !players.includes(this.target)) this.target = null;
    if (this.target) {
      if (this.sees(this.target)) this.spot(this.target);
      else this.unseenFor += dt;
      if (this.unseenFor > this.kind.forgetAfter) this.target = null;
    }
    if (!this.target) {
      const seen = this.nearestSeen(players);
      if (seen) {
        playSound('growl');
        this.target = seen;
        this.spot(seen);
      }
    }

    const k = this.kind;
    const goal = this.target ? this.chaseGoal() : this.wanderGoal();
    let speed = this.target ? k.chaseSpeed : k.wanderSpeed;
    // Turbo makes it faster, but never faster than the players.
    if (this.turboLeft > 0) speed = Math.min(speed * MONSTER_ABILITIES.street.speedUp, PLAYER_SPEED);
    const turn = this.target ? k.chaseTurn : k.wanderTurn;

    const dx = goal.x - this.x;
    const dy = goal.y - this.y;
    const dist = Math.hypot(dx, dy);
    let heading = this.facing;
    if (dist > 4) {
      heading = Math.atan2(dy, dx);
      const step = Math.min(dist, speed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    } else if (this.target) {
      // Where it last saw you, but you're gone: it looks around for you.
      heading = this.facing + Math.PI / 2;
    }

    // Turn the eyes a little each step, so you can see them swing around.
    const maxTurn = turn * dt;
    this.facing += Math.max(-maxTurn, Math.min(maxTurn, angleDiff(this.facing, heading)));
    this.stayInArena();
    this.useAbility(dt, players, floor);
  }

  // Can it hurt a player by touching right now? Not while zapped, frozen, burned up or in the air.
  canHurt(): boolean {
    return this.goneFor === 0 && this.stunnedFor === 0 && this.frozenFor === 0 && this.z <= this.radius;
  }

  isGone(): boolean {
    return this.goneFor > 0;
  }

  // Hit by a 🔥 fireball: it loses a life and flickers. With no lives left it burns up and comes
  // back after POWERS.fire.comeback seconds.
  hitByFire(): void {
    this.lives -= 1;
    this.hitFlash = 0.4;
    playSound(this.lives > 0 ? 'fireHit' : 'monsterBurns');
    if (this.lives > 0) return;
    this.goneFor = POWERS.fire.comeback;
    this.target = null;
    this.jump = null;
    this.z = 0;
  }

  // Come back from burning up in a random place, at least MONSTER.startDistance from every player
  // (where the labyrinth has such a place).
  private comeBack(players: Player[]): void {
    let spot = randomCellCenter();
    for (let tries = 0; tries < 200 && nearAPlayer(spot, players); tries++) spot = randomCellCenter();
    this.x = spot.x;
    this.y = spot.y;
    this.wanderCell = null;
    this.cameFrom = null;
    this.stunnedFor = 0;
    this.frozenFor = 0;
    this.lives = MONSTER.lives;
  }

  // The ability the floor gives it (MONSTER_ABILITIES). The 🏴‍☠️ one only changes how it looks.
  private useAbility(dt: number, players: Player[], floor: FloorName): void {
    this.abilityTimer += dt;
    this.turboLeft = Math.max(0, this.turboLeft - dt);

    if (isTrailKind(floor)) {
      this.dropTimer += dt;
      if (this.dropTimer >= MONSTER_ABILITIES[floor].dropEvery) {
        this.dropTimer = 0;
        dropTrail(this.x, this.y, floor);
      }
    }

    if (floor === 'arcade' && this.abilityTimer >= MONSTER_ABILITIES.arcade.every) {
      this.abilityTimer = 0;
      this.glitch();
    }

    // The other abilities only work while it chases someone.
    const target = this.target;
    if (!target) return;
    if (floor === 'street' && this.abilityTimer >= MONSTER_ABILITIES.street.every) {
      this.abilityTimer = 0;
      this.turboLeft = MONSTER_ABILITIES.street.lasts;
    }
    if (floor === 'chess' && this.abilityTimer >= MONSTER_ABILITIES.chess.every) {
      this.abilityTimer = 0;
      this.startKnightJump();
    }
    if (floor === 'moon' && this.sees(target)) {
      const dx = this.x - target.x;
      const dy = this.y - target.y;
      const dist = Math.hypot(dx, dy) || 1;
      target.x += (dx / dist) * MONSTER_ABILITIES.moon.pull * dt;
      target.y += (dy / dist) * MONSTER_ABILITIES.moon.pull * dt;
      target.stayInArena();
      this.beaming = true;
    }
    if (floor === 'bricks' && this.abilityTimer >= MONSTER_ABILITIES.bricks.every) {
      this.abilityTimer = 0;
      this.dropBrick(players);
    }
  }

  // Disappear and pop up again in a random place up to MONSTER_ABILITIES.arcade.cells cells away.
  private glitch(): void {
    const here = cellOf(this.x, this.y);
    const n = MONSTER_ABILITIES.arcade.cells;
    const pick = () => Math.round((Math.random() * 2 - 1) * n);
    const spot = cellCenter({ col: here.col + pick(), row: here.row + pick() });
    const landing = cellCenter(cellOf(spot.x, spot.y)); // cellOf keeps it inside the labyrinth
    this.x = landing.x;
    this.y = landing.y;
    this.wanderCell = null;
    this.cameFrom = null;
    this.glitchFlash = 0.4;
  }

  // Jump into the neighboring cell closest to where it last saw the player, walls or not,
  // if that brings it closer.
  private startKnightJump(): void {
    const here = cellOf(this.x, this.y);
    const hereMiddle = cellCenter(here);
    const toPlayer = (c: { x: number; y: number }) => Math.hypot(c.x - this.lastSeen.x, c.y - this.lastSeen.y);
    let best = hereMiddle;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const spot = cellCenter({ col: here.col + dc, row: here.row + dr });
      const cell = cellOf(spot.x, spot.y);
      if (cell.col === here.col && cell.row === here.row) continue; // at the edge of the labyrinth
      const middle = cellCenter(cell);
      if (toPlayer(middle) < toPlayer(best)) best = middle;
    }
    if (best === hereMiddle) return;
    this.jump = { fromX: this.x, fromY: this.y, toX: best.x, toY: best.y, t: 0 };
  }

  private updateJump(dt: number): void {
    const j = this.jump!;
    const ability = MONSTER_ABILITIES.chess;
    j.t = Math.min(1, j.t + dt / ability.jumpTime);
    this.x = j.fromX + (j.toX - j.fromX) * j.t;
    this.y = j.fromY + (j.toY - j.fromY) * j.t;
    this.z = Math.sin(Math.PI * j.t) * ability.jumpHeight;
    if (j.t < 1) return;
    this.jump = null;
    this.z = 0;
    this.wanderCell = null;
    this.cameFrom = null;
    this.stayInArena();
  }

  // Put a brick block on the floor right behind it, unless a player stands there.
  private dropBrick(players: Player[]): void {
    const size = MONSTER_ABILITIES.bricks.size;
    const back = this.radius + size / 2 + 6;
    const bx = this.x - Math.cos(this.facing) * back;
    const by = this.y - Math.sin(this.facing) * back;
    if (players.some((p) => Math.hypot(p.x - bx, p.y - by) < size / 2 + p.radius)) return;
    addBlock(bx, by, size, MONSTER_ABILITIES.bricks.lasts);
  }

  // Can the monster's eyes see this player right now? Walls are in the way, except for ghosts.
  sees(p: Player): boolean {
    if (Math.hypot(p.x - this.x, p.y - this.y) > this.kind.sightRange) return false;
    const toPlayer = Math.atan2(p.y - this.y, p.x - this.x);
    const halfAngle = ((this.kind.sightAngle / 2) * Math.PI) / 180;
    if (Math.abs(angleDiff(this.facing, toPlayer)) > halfAngle) return false;
    return this.kind.throughWalls || wallHit(this.x, this.y, p.x, p.y) >= 1;
  }

  stayInArena(): void {
    const r = this.radius;
    this.x = Math.min(Math.max(this.x, r), ARENA.width - r);
    this.y = Math.min(Math.max(this.y, r), ARENA.height - r);
    if (this.kind.throughWalls) return;
    pushOutOfWalls(this);
    this.x = Math.min(Math.max(this.x, r), ARENA.width - r);
    this.y = Math.min(Math.max(this.y, r), ARENA.height - r);
  }

  private spot(p: Player): void {
    this.lastSeen = { x: p.x, y: p.y };
    this.unseenFor = 0;
  }

  // Where to go next while chasing: along the paths to where it last saw the player.
  // A ghost goes straight there, through the walls.
  private chaseGoal(): { x: number; y: number } {
    if (this.kind.throughWalls) return this.lastSeen;
    const here = cellOf(this.x, this.y);
    return this.waypoint(here, cellOf(this.lastSeen.x, this.lastSeen.y), this.lastSeen);
  }

  // Where to go next while wandering: on to a neighboring path cell.
  // A ghost drifts straight toward a random place anywhere in the labyrinth.
  private wanderGoal(): { x: number; y: number } {
    if (this.kind.throughWalls) {
      if (!this.floatTo || Math.hypot(this.floatTo.x - this.x, this.floatTo.y - this.y) < 6) {
        this.floatTo = randomCellCenter();
      }
      return this.floatTo;
    }
    const here = cellOf(this.x, this.y);
    if (!this.wanderCell || this.reached(here, this.wanderCell)) this.pickWanderCell(here);
    return this.waypoint(here, this.wanderCell!, cellCenter(this.wanderCell!));
  }

  // The point to walk to next on the way to a goal cell: the middle of the next cell on the
  // shortest path, or the goal itself once it is in the same cell.
  private waypoint(here: Cell, goalCell: Cell, goal: { x: number; y: number }): { x: number; y: number } {
    const step = nextStep(here, goalCell);
    if (!step) return goal;
    // Line up with the middle of the path first, so it doesn't cut corners into walls.
    const middle = cellCenter(here);
    const offset = step.row === here.row ? Math.abs(this.y - middle.y) : Math.abs(this.x - middle.x);
    if (offset > 8) return middle;
    return cellCenter(step);
  }

  private reached(here: Cell, cell: Cell): boolean {
    const c = cellCenter(cell);
    return sameCell(here, cell) && Math.hypot(c.x - this.x, c.y - this.y) < 6;
  }

  // Walk on to a random open neighbor, and only turn back at a dead end.
  private pickWanderCell(here: Cell): void {
    const options = openNeighbors(here);
    const forward = options.filter((n) => !this.cameFrom || !sameCell(n, this.cameFrom));
    const choices = forward.length > 0 ? forward : options;
    this.cameFrom = here;
    this.wanderCell = choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : here;
  }

  private nearestSeen(players: Player[]): Player | null {
    let best: Player | null = null;
    let bestDist = Infinity;
    for (const p of players) {
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestDist && this.sees(p)) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }
}
