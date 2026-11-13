import {
  ARENA,
  COLORS,
  type Controls,
  FLOORS,
  LIVES,
  MONSTER,
  MONSTER_ABILITIES,
  POWERS,
  type PowerName,
  TRAIL_RADIUS,
  VIEW,
} from './config';
import { allViewports, currentCamera, isFirstPerson, isSplit, project, toPixels, useViewport } from './camera';
import { drawFirstPerson } from './firstperson';
import { currentFloor, drawFloor, floorWallColor } from './floors';
import { mazeWalls, type Wall, wallHit } from './maze';
import type { Monster } from './monster';
import type { Player } from './player';
import { allFireballs, allFlashes, type Fireball, FLASH_TIME, type Flash } from './powers';
import { trailSpots } from './trails';

// Mix two '#rrggbb' colors: amount 0 = all a, 1 = all b.
function mixColors(a: string, b: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - amount) + channel(b, i) * amount));
  return '#' + mixed.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
  if (p.isDead()) {
    drawCountdown(ctx, p);
    return;
  }
  // Right after a monster touch the player blinks, and the lives it lost float above it.
  // A bonus life floats up as a green "+1".
  const hurtFor = LIVES.safeTime - p.safeFor;
  if (p.safeFor > 0 && hurtFor < 1) drawLivesChange(ctx, p, `-${p.lastLivesLost}`, '#ff3b3b', hurtFor);
  if (p.bonusShownFor > 0) drawLivesChange(ctx, p, '+1', '#4cd964', 1 - p.bonusShownFor);
  if (p.safeFor > 0 && Math.floor(p.safeFor * 8) % 2 === 0) return;
  const ground = project(p.x, p.y);
  const body = project(p.x, p.y, p.z);
  const r = toPixels(p.radius, p.y);
  const rings = currentCamera().rings; // flat ovals in 3D, circles in 2D

  // Shadow shrinks as the player hops higher.
  const shadow = Math.max(0.4, 1 - p.z / 300);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, r * shadow, r * rings * shadow, 0, 0, Math.PI * 2);
  ctx.fill();

  // Colored ring so you can tell players apart even with similar emojis.
  ctx.strokeStyle = p.config.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, r, r * rings, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `${Math.round(r * 2)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#000'; // opaque, or the emoji inherits the shadow's transparency
  ctx.fillText(p.emoji, body.sx, body.sy + r * 0.3);
}

// The area the monster's eyes can see, painted on the floor and cut off at the arena edges.
function drawSight(ctx: CanvasRenderingContext2D, m: Monster): void {
  ctx.save();
  ctx.beginPath();
  for (const [x, y] of [[0, 0], [ARENA.width, 0], [ARENA.width, ARENA.height], [0, ARENA.height]]) {
    const c = project(x, y);
    ctx.lineTo(c.sx, c.sy);
  }
  ctx.clip();

  // Each line of sight stops at the first wall, so the monster can't see around corners.
  // Ghosts see through walls.
  const half = ((m.kind.sightAngle / 2) * Math.PI) / 180;
  const steps = 32;
  ctx.beginPath();
  const eye = project(m.x, m.y);
  ctx.moveTo(eye.sx, eye.sy);
  for (let i = 0; i <= steps; i++) {
    const a = m.facing - half + (2 * half * i) / steps;
    const farX = m.x + Math.cos(a) * m.kind.sightRange;
    const farY = m.y + Math.sin(a) * m.kind.sightRange;
    const reach = m.kind.throughWalls ? 1 : wallHit(m.x, m.y, farX, farY);
    const edge = project(m.x + (farX - m.x) * reach, m.y + (farY - m.y) * reach);
    ctx.lineTo(edge.sx, edge.sy);
  }
  ctx.closePath();
  ctx.fillStyle = m.target ? MONSTER.colors.sightChasing : MONSTER.colors.sight;
  ctx.fill();
  ctx.restore();
}

// How see-through a monster is drawn, in every view.
function monsterAlpha(m: Monster): number {
  const chasing = m.target !== null && m.stunnedFor === 0 && m.frozenFor === 0;
  // Ghosts are see-through, so you can tell them apart and see them float over walls.
  let alpha = m.kind.throughWalls ? MONSTER.ghostOpacity : 1;
  // 🏴‍☠️ Buried: almost invisible until it chases someone.
  if (currentFloor() === 'map' && !chasing) alpha *= MONSTER_ABILITIES.map.visibility;
  // 👾 Glitch: it flickers for a moment after popping up.
  if (m.glitchFlash > 0 && Math.floor(m.glitchFlash * 20) % 2 === 0) alpha *= 0.3;
  // 🔥 Hit by a fireball: it flickers too.
  if (m.hitFlash > 0 && Math.floor(m.hitFlash * 20) % 2 === 0) alpha *= 0.3;
  return alpha;
}

// A monster seen from above: its shadow on the floor, and the monster standing on it.
function drawMonster(ctx: CanvasRenderingContext2D, m: Monster): void {
  const ground = project(m.x, m.y);
  const r = toPixels(m.radius, m.y);
  const rings = currentCamera().rings;
  ctx.save();
  ctx.globalAlpha = monsterAlpha(m);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, r, r * rings, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Which way "looking" goes on screen, so the pupils match the camera view.
  const ahead = project(m.x + Math.cos(m.facing), m.y + Math.sin(m.facing));
  const len = Math.hypot(ahead.sx - ground.sx, ahead.sy - ground.sy) || 1;
  // Seen from above (2D) the body sits on its shadow; in the tilted view it stands up from it.
  // During a 👑 knight jump it rises above its shadow.
  const cy = ground.sy - r * (1 - rings) - toPixels(m.z, m.y);
  drawMonsterFigure(ctx, m, ground.sx, cy, r, (ahead.sx - ground.sx) / len, (ahead.sy - ground.sy) / len);
}

// The monster itself, with its body's middle at screen point (x, y) and body radius r in
// pixels; used from above and in first person. (lookX, lookY): the screen direction its pupils
// point. A dark, spiky, horned monster with clawed arms, angry eyes and sharp teeth. While it
// chases someone, its eyes glow red, its mouth opens wide, its fur bristles, it reaches out with
// its claws and it trembles. Its lives show as hearts under it.
export function drawMonsterFigure(
  ctx: CanvasRenderingContext2D,
  m: Monster,
  x: number,
  y: number,
  r: number,
  lookX: number,
  lookY: number,
): void {
  // A zapped or frozen monster can't chase, so it doesn't look like it does.
  const zapped = m.stunnedFor > 0;
  const frozen = m.frozenFor > 0;
  const chasing = m.target !== null && !zapped && !frozen;
  const c = MONSTER.colors;
  const costume = FLOORS[currentFloor()];
  ctx.save();
  ctx.globalAlpha = monsterAlpha(m);

  // Its lives, as small hearts under it: ❤️ for each left, 🖤 for each lost.
  ctx.font = `${Math.round(r * 0.45)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.fillText('❤️'.repeat(m.lives) + '🖤'.repeat(MONSTER.lives - m.lives), x, y + r);

  // It trembles with rage while chasing, and twitches while zapped.
  const shake = chasing || zapped ? MONSTER.shake : 0;
  const cx = x + (Math.random() * 2 - 1) * shake;
  const cy = y + (Math.random() * 2 - 1) * shake;

  // Horns, drawn first so the body covers their bottoms.
  ctx.fillStyle = c.horns;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * r * 0.25, cy - r * 0.8);
    ctx.lineTo(cx + side * r * 0.85, cy - r * 1.45);
    ctx.lineTo(cx + side * r * 0.75, cy - r * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // Long arms with claws. They hang down while wandering and reach up and grab while chasing.
  const time = performance.now() / 1000;
  for (const side of [-1, 1]) {
    const grab = chasing ? Math.sin(time * 10 + side) * 0.15 : 0;
    const hx = cx + side * r * 1.35;
    const hy = cy + (chasing ? -r * (0.45 + grab) : r * 0.55);
    ctx.strokeStyle = mixColors(m.kind.arms, costume.monsterColor, MONSTER.costumeStrength);
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * r * 0.6, cy + r * 0.1);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Three claws fanning out from each hand, pointing away from the body.
    ctx.strokeStyle = c.claws;
    ctx.lineWidth = r * 0.07;
    const out = Math.atan2(hy - cy, hx - cx);
    for (const spread of [-0.6, 0, 0.6]) {
      const a = out + spread;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a) * r * 0.32, hy + Math.sin(a) * r * 0.32);
      ctx.stroke();
    }
  }

  // Shaggy body with spiky fur that bristles a little all the time, and more while chasing.
  const bristle = chasing ? 0.35 : 0.12;
  ctx.fillStyle = mixColors(m.kind.body, costume.monsterColor, MONSTER.costumeStrength);
  ctx.beginPath();
  for (let i = 0; i < MONSTER.spikes * 2; i++) {
    const a = (i / (MONSTER.spikes * 2)) * Math.PI * 2;
    const tip = i % 2 === 0;
    const wobble = 1 + Math.sin(time * 6 + i * 1.7) * bristle * MONSTER.spikeLength;
    const dist = tip ? r * (1 + MONSTER.spikeLength) * wobble : r * 0.92;
    ctx.lineTo(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
  }
  ctx.closePath();
  ctx.fill();

  const eyeR = r * 0.24;
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.38;
    const ey = cy - r * 0.2;
    ctx.save();
    if (chasing) {
      ctx.shadowColor = c.eyesChasing;
      ctx.shadowBlur = r * 0.6;
    }
    ctx.fillStyle = chasing ? c.eyesChasing : c.eyes;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Narrow slit pupils, like a cat's or a snake's.
    ctx.fillStyle = c.pupils;
    ctx.beginPath();
    ctx.ellipse(ex + lookX * eyeR * 0.45, ey + lookY * eyeR * 0.45, eyeR * 0.25, eyeR * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Angry eyebrow: slants down toward the middle of the face.
    ctx.strokeStyle = c.brows;
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex + side * eyeR * 1.1, ey - eyeR * 1.5);
    ctx.lineTo(ex - side * eyeR * 1.0, ey - eyeR * 0.7);
    ctx.stroke();
  }

  // Mouth full of pointy teeth, opening wide while it chases.
  const mouthTop = cy + r * 0.22;
  const mouthW = r * 0.62;
  const mouthH = r * (chasing ? 0.5 : 0.25);
  ctx.fillStyle = c.mouth;
  ctx.beginPath();
  ctx.moveTo(cx - mouthW, mouthTop);
  ctx.lineTo(cx + mouthW, mouthTop);
  ctx.quadraticCurveTo(cx, mouthTop + mouthH * 2, cx - mouthW, mouthTop);
  ctx.fill();

  const teeth = 5;
  const toothW = (mouthW * 2) / teeth;
  ctx.fillStyle = c.teeth;
  for (let i = 0; i < teeth; i++) {
    const left = cx - mouthW + i * toothW;
    ctx.beginPath();
    ctx.moveTo(left, mouthTop);
    ctx.lineTo(left + toothW, mouthTop);
    ctx.lineTo(left + toothW / 2, mouthTop + mouthH * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  // The floor's costume hat, between the horns.
  ctx.font = `${Math.round(r * 0.9)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#000';
  ctx.fillText(costume.monsterHat, cx, cy - r * 0.7);

  if (chasing) {
    ctx.font = `${Math.round(r)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText('❗', cx, cy - r * 1.75); // above the hat
  }

  // ❄️ Frozen: stuck in a block of ice. ⚡ Zapped: sparks above its head.
  if (frozen) {
    ctx.fillStyle = 'rgba(190,235,255,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - r * 1.3, cy - r * 1.6, r * 2.6, r * 2.8, r * 0.3);
    ctx.fill();
    ctx.stroke();
  }
  if (frozen || zapped) {
    ctx.font = `${Math.round(r)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillStyle = '#000';
    ctx.fillText(frozen ? POWERS.ice.emoji : POWERS.lightning.emoji, cx, cy - r * 1.75);
  }
  ctx.restore();
}

// A labyrinth wall as a block: flat from straight above (2D), standing up in the tilted view (3D).
// It shows the side that faces the middle of the screen, the front, and the top.
function drawWall(ctx: CanvasRenderingContext2D, w: Wall): void {
  const h = currentCamera().mazeWalls;
  const color = floorWallColor();
  const face = (points: [number, number, number][], shade: string) => {
    ctx.beginPath();
    for (const [x, y, z] of points) {
      const p = project(x, y, z);
      ctx.lineTo(p.sx, p.sy);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.fill();
  };

  if (h > 0) {
    const middle = ARENA.width / 2;
    if (w.x1 > middle) face([[w.x1, w.y1, 0], [w.x1, w.y2, 0], [w.x1, w.y2, h], [w.x1, w.y1, h]], 'rgba(0,0,0,0.3)');
    if (w.x2 < middle) face([[w.x2, w.y1, 0], [w.x2, w.y2, 0], [w.x2, w.y2, h], [w.x2, w.y1, h]], 'rgba(0,0,0,0.3)');
    face([[w.x1, w.y2, 0], [w.x2, w.y2, 0], [w.x2, w.y2, h], [w.x1, w.y2, h]], 'rgba(0,0,0,0.15)');
  }
  face([[w.x1, w.y1, h], [w.x2, w.y1, h], [w.x2, w.y2, h], [w.x1, w.y2, h]], 'rgba(255,255,255,0.25)');
}

// A skull where a player with 0 lives went out, and the seconds until it comes back.
function drawCountdown(ctx: CanvasRenderingContext2D, p: Player): void {
  const r = toPixels(p.radius, p.y);
  const at = project(p.x, p.y);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.round(r * 1.6)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillStyle = '#000';
  ctx.fillText('💀', at.sx, at.sy + r * 0.3);
  ctx.font = `bold ${Math.round(r)}px system-ui, sans-serif`;
  ctx.fillStyle = p.config.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  const seconds = String(Math.ceil(p.respawnIn));
  ctx.strokeText(seconds, at.sx, at.sy - r * 1.4);
  ctx.fillText(seconds, at.sx, at.sy - r * 1.4);
}

// Text like "-3" or "+1" rising and fading above a player for one second. age: seconds since it appeared.
function drawLivesChange(ctx: CanvasRenderingContext2D, p: Player, text: string, color: string, age: number): void {
  const at = project(p.x, p.y, p.z + p.radius * 2.5 + age * 60);
  ctx.save();
  ctx.globalAlpha = 1 - age;
  ctx.font = `bold ${Math.round(toPixels(p.radius, p.y))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(text, at.sx, at.sy);
  ctx.fillText(text, at.sx, at.sy);
  ctx.restore();
}

// Key codes as printed on the key. Slash is '-' on Swiss keyboards and '/' on US ones.
const KEY_LABELS: Record<string, string> = { Comma: ',', Period: '.', Slash: '-' };
function keyLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '').replace(/^Arrow/, '');
}

const POWER_NAMES = Object.keys(POWERS) as PowerName[];

function controlsText(c: Controls): { move: string; action: string } {
  const powers = POWER_NAMES.map((power) => `${POWERS[power].emoji}${keyLabel(c[power])}`).join(' ');
  return {
    move: `move: ${[c.up, c.left, c.down, c.right].map(keyLabel).join(' ')}`,
    action: `hop: ${keyLabel(c.action)}   ${powers}`,
  };
}

// Each power's emoji, with the seconds left while it cools down.
function powersText(p: Player): string {
  return POWER_NAMES.map((power) => {
    const left = p.cooldowns[power];
    return left > 0 ? `${POWERS[power].emoji}${Math.ceil(left)}` : POWERS[power].emoji;
  }).join(' ');
}

function drawHud(ctx: CanvasRenderingContext2D, players: Player[], showKeys: string[] | null): void {
  ctx.textBaseline = 'top';

  // In narrow windows the two players' control lines would collide in the middle,
  // so split each into a "move" line and an "action" line.
  ctx.font = '14px system-ui, sans-serif';
  const oneLine = players.map((p) => {
    const t = controlsText(p.config.controls);
    return `${t.move}   ${t.action}`;
  });
  const widths = oneLine.map((line) => ctx.measureText(line).width);
  const split = widths[0] + widths[1] + 2 * 24 + 24 > VIEW.width;

  players.forEach((p, i) => {
    const cfg = p.config;
    const left = i === 0;
    ctx.textAlign = left ? 'left' : 'right';
    const x = left ? 24 : VIEW.width - 24;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = cfg.color;
    const status = p.isDead() ? `💀 back in ${Math.ceil(p.respawnIn)}` : `❤️ ${p.lives}   ${powersText(p)}`;
    ctx.fillText(`${p.emoji} ${cfg.name}   ${status}`, x, 20);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    if (split) {
      const t = controlsText(cfg.controls);
      ctx.fillText(t.move, x, 50);
      ctx.fillText(t.action, x, 68);
    } else {
      ctx.fillText(oneLine[i], x, 50);
    }
  });

  // The monsters' ability on this floor, in the middle at the top.
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`👹 ${MONSTER_ABILITIES[currentFloor()].name}`, VIEW.width / 2, 24);

  if (showKeys) {
    ctx.textAlign = 'center';
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffd43b';
    ctx.fillText(`held (${showKeys.length}): ${showKeys.join(' ')}`, VIEW.width / 2, VIEW.height - 28);
  }
}

// Spots monsters leave on the floor (🍄 spores, ❄️ ice, 🔥 fire). They fade out in their last second.
function drawTrails(ctx: CanvasRenderingContext2D): void {
  const rings = currentCamera().rings;
  const time = performance.now() / 1000;
  for (const s of trailSpots()) {
    const ability = MONSTER_ABILITIES[s.kind];
    const at = project(s.x, s.y);
    // Fire flickers a little.
    const flicker = s.kind === 'lava' ? 0.85 + 0.15 * Math.sin(time * 15 + s.x) : 1;
    const r = toPixels(TRAIL_RADIUS, s.y) * flicker;
    ctx.globalAlpha = Math.min(1, ability.lasts - s.age);
    ctx.fillStyle = ability.color;
    ctx.beginPath();
    ctx.ellipse(at.sx, at.sy, r, r * rings, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 🛸 A tractor beam on the floor: narrow at the monster, wide at the player it pulls.
function drawBeam(ctx: CanvasRenderingContext2D, m: Monster, p: Player): void {
  const angle = Math.atan2(p.y - m.y, p.x - m.x);
  const side = { x: -Math.sin(angle), y: Math.cos(angle) };
  const narrow = m.radius * 0.3;
  const wide = p.radius * 1.3;
  const corners = [
    project(m.x + side.x * narrow, m.y + side.y * narrow),
    project(p.x + side.x * wide, p.y + side.y * wide),
    project(p.x - side.x * wide, p.y - side.y * wide),
    project(m.x - side.x * narrow, m.y - side.y * narrow),
  ];
  ctx.fillStyle = MONSTER_ABILITIES.moon.color;
  ctx.beginPath();
  for (const c of corners) ctx.lineTo(c.sx, c.sy);
  ctx.closePath();
  ctx.fill();
}

// Floor, sight areas, walls, players and monsters, as seen by the current viewport's camera.
function drawWorld(ctx: CanvasRenderingContext2D, players: Player[], monsters: Monster[]): void {
  drawFloor(ctx);
  drawTrails(ctx);
  // Zapped, frozen and burned-up monsters don't look around.
  for (const m of monsters) if (m.canHurt()) drawSight(ctx, m);
  for (const m of monsters) if (m.beaming && m.target) drawBeam(ctx, m, m.target);
  for (const f of allFlashes()) if (f.kind === 'ice') drawIceRing(ctx, f);
  // Draw far things first so near ones overlap them.
  // Walls count by their front edge: whatever stands behind it gets covered.
  const things = [
    ...mazeWalls().map((w) => ({ y: w.y2, draw: () => drawWall(ctx, w) })),
    ...players.map((p) => ({ y: p.y, draw: () => drawPlayer(ctx, p) })),
    ...monsters.filter((m) => !m.isGone()).map((m) => ({ y: m.y, draw: () => drawMonster(ctx, m) })),
    ...allFireballs().map((f) => ({ y: f.y, draw: () => drawFireball(ctx, f) })),
  ];
  things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
  for (const f of allFlashes()) if (f.kind === 'lightning') drawLightning(ctx, f);
}

// 🔥 A fireball flying a little above the floor, with its shadow.
function drawFireball(ctx: CanvasRenderingContext2D, f: Fireball): void {
  const ground = project(f.x, f.y);
  const air = project(f.x, f.y, 25);
  const r = toPixels(POWERS.fire.radius, f.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, r, r * currentCamera().rings, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${Math.round(r * 2.4)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(POWERS.fire.emoji, air.sx, air.sy);
}

// ⚡ A jagged yellow bolt from the player to the zapped monster, fading out.
function drawLightning(ctx: CanvasRenderingContext2D, f: Flash): void {
  const from = project(f.fromX, f.fromY, 30);
  const to = project(f.toX, f.toY, 30);
  const steps = 8;
  ctx.save();
  ctx.globalAlpha = 1 - f.age / FLASH_TIME;
  ctx.strokeStyle = '#fff36b';
  ctx.shadowColor = '#fff36b';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const zig = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * 14;
    ctx.lineTo(from.sx + (to.sx - from.sx) * t + zig, from.sy + (to.sy - from.sy) * t + zig);
  }
  ctx.stroke();
  ctx.restore();
}

// ❄️ A ring of frost on the floor, growing out to the ice power's radius.
function drawIceRing(ctx: CanvasRenderingContext2D, f: Flash): void {
  const grow = f.age / FLASH_TIME;
  const steps = 40;
  ctx.save();
  ctx.globalAlpha = 1 - grow;
  ctx.strokeStyle = '#bfefff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const p = project(f.fromX + Math.cos(a) * POWERS.ice.radius * grow, f.fromY + Math.sin(a) * POWERS.ice.radius * grow);
    ctx.lineTo(p.sx, p.sy);
  }
  ctx.stroke();
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  players: Player[],
  monsters: Monster[],
  canRestart: boolean,
  gameOver: boolean,
  showKeys: string[] | null,
): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Split screen: one viewport per player, framed in the player's color, seen from above or
  // through the player's eyes. One shared screen: a single viewport with a neutral frame.
  allViewports().forEach((v, i) => {
    useViewport(v);
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.left, v.top, v.width, v.height);
    ctx.clip();
    if (isFirstPerson()) drawFirstPerson(ctx, v, players[i], players, monsters);
    else drawWorld(ctx, players, monsters);
    ctx.restore();
    ctx.strokeStyle = isSplit() ? players[i].config.color : COLORS.text;
    ctx.lineWidth = 3;
    ctx.strokeRect(v.left, v.top, v.width, v.height);
  });
  drawHud(ctx, players, showKeys);
  if (gameOver) drawGameOver(ctx, players, canRestart);
}

// Both players were out at once: darken the game and say how to play again.
function drawGameOver(ctx: CanvasRenderingContext2D, players: Player[], canRestart: boolean): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff3b3b';
  ctx.font = `bold ${Math.round(Math.min(VIEW.width / 8, 110))}px system-ui, sans-serif`;
  ctx.fillText('GAME OVER', VIEW.width / 2, VIEW.height / 2 - 30);
  if (canRestart) {
    const keys = players.map((p) => keyLabel(p.config.controls.action)).join(' or ');
    ctx.fillStyle = COLORS.text;
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(`Press ${keys} to play again`, VIEW.width / 2, VIEW.height / 2 + 50);
  }
}
