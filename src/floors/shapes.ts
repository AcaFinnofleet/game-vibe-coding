// Shapes lying flat on the floor, shared by the floor painters. Positions and sizes are in world units.
import { currentViewport, project, toPixels } from '../camera';

// Add a rectangle lying flat on the floor to the current path.
export function floorRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const a = project(x, y);
  const b = project(x + w, y);
  const c = project(x + w, y + h);
  const d = project(x, y + h);
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
}

// Add an ellipse lying flat on the floor to the current path. Small ones can use fewer steps.
// Ellipses entirely outside the current viewport are skipped: the arena is much bigger than a
// viewport, and some floors have thousands of them.
export function floorEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, steps = 24): void {
  const middle = project(x, y);
  const reach = toPixels(Math.max(rx, ry), y);
  const v = currentViewport();
  if (
    middle.sx + reach < v.left ||
    middle.sx - reach > v.left + v.width ||
    middle.sy + reach < v.top ||
    middle.sy - reach > v.top + v.height
  ) {
    return;
  }
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const p = project(x + Math.cos(angle) * rx, y + Math.sin(angle) * ry);
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
}

// Add a straight line on the floor to the current path.
export function floorLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const a = project(x1, y1);
  const b = project(x2, y2);
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
}

// The same "random" number between 0 and 1 for the same inputs, so patterns don't flicker.
export function noise(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Where the first grid line goes so the grid is lined up from the middle and both halves match.
export function gridStart(length: number, cell: number): number {
  return length / 2 - Math.ceil(length / 2 / cell) * cell;
}

// Add a lumpy round shape lying flat on the floor to the current path. Same seed, same shape.
export function floorBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number): void {
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobbly = r * (0.8 + 0.4 * noise(seed, i));
    const p = project(x + Math.cos(angle) * wobbly, y + Math.sin(angle) * wobbly);
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
}

// Add a jagged crack to the current path. It wanders off in direction `angle` and sometimes branches.
export function floorCrack(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, seed: number): void {
  const step = 12;
  let p = project(x, y);
  ctx.moveTo(p.sx, p.sy);
  for (let i = 0; i * step < length; i++) {
    angle += (noise(seed, i) - 0.5) * 1.2;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    p = project(x, y);
    ctx.lineTo(p.sx, p.sy);
    if (length * 0.3 >= step && noise(seed, i + 500) < 0.15) {
      const side = noise(seed, i + 900) < 0.5 ? -1 : 1;
      floorCrack(ctx, x, y, angle + side * 0.9, length * 0.3, seed * 7 + i);
      ctx.moveTo(p.sx, p.sy);
    }
  }
}
