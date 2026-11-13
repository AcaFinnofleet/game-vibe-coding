// First person: draws what a player sees through their own eyes into their viewport.
// Walls are drawn slice by slice: for each slice of the viewport, a line of sight goes out from
// the player and the nearest wall it meets is drawn, taller the closer it is. Monsters, the other
// player, fireballs and trail spots are drawn as flat pictures that always face the viewer,
// hidden where a nearer wall covers them. Positions are in world units, sizes on screen in pixels.
import type { Viewport } from './camera';
import { ARENA, FIRST_PERSON, FLOORS, MONSTER_ABILITIES, POWERS, TRAIL_RADIUS } from './config';
import { currentFloor, floorWallColor } from './floors';
import { mazeWalls, type Wall } from './maze';
import type { Monster } from './monster';
import type { Player } from './player';
import { allFireballs } from './powers';
import { drawMonsterFigure } from './render';
import { trailSpots } from './trails';

const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const TRAIL_EMOJI = { wood: '🍄', ice: '🧊', lava: '🔥' } as const;

// The arena edges, as walls just outside it.
function borderWalls(): Wall[] {
  const t = 40;
  return [
    { x1: -t, y1: -t, x2: ARENA.width + t, y2: 0 },
    { x1: -t, y1: ARENA.height, x2: ARENA.width + t, y2: ARENA.height + t },
    { x1: -t, y1: 0, x2: 0, y2: ARENA.height },
    { x1: ARENA.width, y1: 0, x2: ARENA.width + t, y2: ARENA.height },
  ];
}

// '#rrggbb' -> [r, g, b]
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

// How far along the line of sight from (x, y) in direction (dx, dy) the wall starts, or Infinity
// if the line misses it. Also says whether it meets a side facing east/west (true) or north/south.
function hitWall(x: number, y: number, dx: number, dy: number, w: Wall): { t: number; eastWest: boolean } | null {
  const tx1 = dx === 0 ? -Infinity : (w.x1 - x) / dx;
  const tx2 = dx === 0 ? Infinity : (w.x2 - x) / dx;
  const ty1 = dy === 0 ? -Infinity : (w.y1 - y) / dy;
  const ty2 = dy === 0 ? Infinity : (w.y2 - y) / dy;
  if (dx === 0 && (x < w.x1 || x > w.x2)) return null;
  if (dy === 0 && (y < w.y1 || y > w.y2)) return null;
  const nearX = Math.min(tx1, tx2);
  const nearY = Math.min(ty1, ty2);
  const enter = Math.max(nearX, nearY);
  const exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
  if (enter > exit || enter < 0) return null;
  return { t: enter, eastWest: nearX > nearY };
}

export function drawFirstPerson(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  me: Player,
  players: Player[],
  monsters: Monster[],
): void {
  const F = FIRST_PERSON;
  const halfFov = ((F.fov / 2) * Math.PI) / 180;
  const plane = v.width / 2 / Math.tan(halfFov); // distance to the screen, in pixels
  const horizon = v.top + v.height / 2;
  const eye = F.eyeHeight + me.z * 0.5; // hopping lifts your eyes a little
  const ground = FLOORS[currentFloor()].ground;
  const sky = rgb(F.sky);
  // Mix a color with the dark of the sky the farther away it is.
  const fog = (color: [number, number, number], dist: number, shade = 1) => {
    const f = Math.min(1, dist / F.viewDistance);
    const mixed = color.map((c, i) => Math.round(c * shade * (1 - f) + sky[i] * f));
    return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
  };

  // Sky above the horizon, floor below it, fading into the dark toward the horizon.
  ctx.fillStyle = F.sky;
  ctx.fillRect(v.left, v.top, v.width, v.height / 2);
  const floorFade = ctx.createLinearGradient(0, horizon, 0, v.top + v.height);
  floorFade.addColorStop(0, F.sky);
  floorFade.addColorStop(1, ground);
  ctx.fillStyle = floorFade;
  ctx.fillRect(v.left, horizon, v.width, v.height / 2);

  // Walls, slice by slice. Only walls within view distance and at least partly in front of the
  // player are checked: walls behind the player can't be seen.
  const reach = F.viewDistance + 200;
  const ahead = { x: Math.cos(me.facing), y: Math.sin(me.facing) };
  const inFront = (x: number, y: number) => (x - me.x) * ahead.x + (y - me.y) * ahead.y > -50;
  const walls = [...mazeWalls(), ...borderWalls()].filter(
    (w) =>
      w.x2 > me.x - reach &&
      w.x1 < me.x + reach &&
      w.y2 > me.y - reach &&
      w.y1 < me.y + reach &&
      (inFront(w.x1, w.y1) || inFront(w.x2, w.y1) || inFront(w.x1, w.y2) || inFront(w.x2, w.y2)),
  );
  const wallColor = rgb(floorWallColor());
  const slices = Math.ceil(v.width / F.column);
  const depth = new Float32Array(slices); // distance to the wall in each slice, for hiding pictures
  for (let i = 0; i < slices; i++) {
    const offset = (i * F.column + F.column / 2 - v.width / 2) / plane;
    const angle = me.facing + Math.atan(offset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let nearest = F.viewDistance;
    let eastWest = false;
    for (const w of walls) {
      const hit = hitWall(me.x, me.y, dx, dy, w);
      if (hit && hit.t < nearest) {
        nearest = hit.t;
        eastWest = hit.eastWest;
      }
    }
    // Straight-ahead distance, so walls don't bulge like through a fish-eye lens.
    const dist = Math.max(1, nearest * Math.cos(angle - me.facing));
    depth[i] = dist;
    if (nearest >= F.viewDistance) continue;
    const top = horizon - ((F.wallHeight - eye) / dist) * plane;
    const bottom = horizon + (eye / dist) * plane;
    ctx.fillStyle = fog(wallColor, dist, eastWest ? 0.75 : 1);
    ctx.fillRect(v.left + i * F.column, top, F.column + 0.5, bottom - top);
  }

  // Pictures standing in the world, farthest first so nearer ones cover them.
  interface Picture {
    x: number;
    y: number;
    draw: (sx: number, footY: number, scale: number) => void;
  }
  const pictures: Picture[] = [];
  for (const s of trailSpots()) {
    const ability = MONSTER_ABILITIES[s.kind];
    pictures.push({
      x: s.x,
      y: s.y,
      draw: (sx, footY, scale) => {
        ctx.globalAlpha = Math.min(1, ability.lasts - s.age);
        drawEmoji(ctx, TRAIL_EMOJI[s.kind], sx, footY, TRAIL_RADIUS * 1.4 * scale);
        ctx.globalAlpha = 1;
      },
    });
  }
  for (const m of monsters) {
    if (m.isGone()) continue;
    pictures.push({
      x: m.x,
      y: m.y,
      draw: (sx, footY, scale) => {
        const r = m.radius * scale;
        // Its pupils point the way it looks, seen from where you stand.
        const lookX = Math.sin(m.facing - me.facing);
        drawMonsterFigure(ctx, m, sx, footY - r - m.z * scale, r, lookX, 0.2);
      },
    });
  }
  for (const p of players) {
    if (p === me) continue;
    pictures.push({
      x: p.x,
      y: p.y,
      draw: (sx, footY, scale) => {
        const size = p.radius * 2.2 * scale;
        if (p.isDead()) {
          drawEmoji(ctx, '💀', sx, footY, size);
          return;
        }
        if (p.safeFor > 0 && Math.floor(p.safeFor * 8) % 2 === 0) return; // blinking after a hurt
        ctx.strokeStyle = p.config.color;
        ctx.lineWidth = Math.max(2, 4 * scale);
        ctx.beginPath();
        ctx.ellipse(sx, footY, p.radius * scale, p.radius * scale * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        drawEmoji(ctx, p.emoji, sx, footY - p.z * scale, size);
      },
    });
  }
  for (const f of allFireballs()) {
    pictures.push({
      x: f.x,
      y: f.y,
      draw: (sx, footY, scale) => drawEmoji(ctx, POWERS.fire.emoji, sx, footY - 15 * scale, POWERS.fire.radius * 2.6 * scale),
    });
  }

  const placed = pictures
    .map((pic) => {
      const dx = pic.x - me.x;
      const dy = pic.y - me.y;
      const turn = Math.atan2(Math.sin(Math.atan2(dy, dx) - me.facing), Math.cos(Math.atan2(dy, dx) - me.facing));
      return { pic, turn, dist: Math.hypot(dx, dy) * Math.cos(turn) };
    })
    .filter((p) => p.dist > 20 && p.dist < F.viewDistance && Math.abs(p.turn) < halfFov + 0.3)
    .sort((a, b) => b.dist - a.dist);

  for (const { pic, turn, dist } of placed) {
    const scale = plane / dist;
    const sx = v.left + v.width / 2 + Math.tan(turn) * plane;
    const footY = horizon + (eye / dist) * plane;
    // Hide the parts of the picture behind nearer walls: only draw in slices where the wall is farther.
    const halfWidth = 90 * scale;
    const first = Math.max(0, Math.floor((sx - halfWidth - v.left) / F.column));
    const last = Math.min(slices - 1, Math.ceil((sx + halfWidth - v.left) / F.column));
    ctx.save();
    ctx.beginPath();
    let visible = false;
    for (let i = first; i <= last; i++) {
      if (depth[i] <= dist) continue;
      ctx.rect(v.left + i * F.column, v.top, F.column + 0.5, v.height);
      visible = true;
    }
    if (visible) {
      ctx.clip();
      pic.draw(sx, footY, scale);
    }
    ctx.restore();
  }
}

// An emoji standing with its bottom at (x, footY), size pixels tall.
function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, footY: number, size: number): void {
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#000';
  ctx.fillText(emoji, x, footY);
}
