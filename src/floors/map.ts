import { TREASURE_MAP } from '../config';
import { project } from '../camera';
import { floorBlob, floorEllipse, floorLine, floorRect, gridStart, noise } from './shapes';

export function paintTreasureMap(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const colors = TREASURE_MAP.colors;

  ctx.fillStyle = colors.table;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  // Torn paper: walk around the edge of the floor, wobbling in and out.
  const margin = 10;
  const step = 20;
  const edge: [number, number][] = [];
  let n = 0;
  const wobble = () => (noise(n++, 13) - 0.5) * 12;
  for (let x = margin; x < W - margin; x += step) edge.push([x, margin + wobble()]);
  for (let y = margin; y < H - margin; y += step) edge.push([W - margin + wobble(), y]);
  for (let x = W - margin; x > margin; x -= step) edge.push([x, H - margin + wobble()]);
  for (let y = H - margin; y > margin; y -= step) edge.push([margin + wobble(), y]);
  const tracePaper = () => {
    ctx.beginPath();
    edge.forEach(([x, y], i) => {
      const p = project(x, y);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    });
    ctx.closePath();
  };
  ctx.fillStyle = colors.paper;
  tracePaper();
  ctx.fill();

  // Everything drawn on the map stays on the paper.
  ctx.save();
  ctx.clip();

  ctx.strokeStyle = colors.lines;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gridStart(W, 100); x < W; x += 100) floorLine(ctx, x, 0, x, H);
  for (let y = gridStart(H, 100); y < H; y += 100) floorLine(ctx, 0, y, W, y);
  ctx.stroke();

  ctx.fillStyle = colors.stains;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    floorBlob(ctx, noise(i, 14) * W, noise(i, 15) * H, 25 + noise(i, 16) * 40, i + 60);
    ctx.fill();
  }

  // Two mountain ranges, one on each half.
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const cx of [W * 0.25, W * 0.75]) {
    for (const [dx, s] of [[-22, 16], [0, 22], [22, 14]]) {
      const left = project(cx + dx - s, H * 0.22);
      const top = project(cx + dx, H * 0.22 - s);
      const right = project(cx + dx + s, H * 0.22);
      ctx.moveTo(left.sx, left.sy);
      ctx.lineTo(top.sx, top.sy);
      ctx.lineTo(right.sx, right.sy);
    }
  }
  ctx.stroke();

  // Compass rose in the far-right corner: a ring and an 8-pointed star.
  const cx = W - 70;
  const cy = 70;
  const r = 34;
  ctx.beginPath();
  floorEllipse(ctx, cx, cy, r * 0.75, r * 0.75);
  ctx.stroke();
  ctx.fillStyle = colors.ink;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.55 : r * 0.18;
    const p = project(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
  ctx.fill();

  // Dotted trail from both sides to the X in the middle, mirrored so it's the same way for both players.
  ctx.fillStyle = colors.trail;
  ctx.beginPath();
  for (let x = 30; x < W / 2 - 30; x += 16) {
    const y = H / 2 + H * 0.15 * Math.sin((x / (W / 2)) * Math.PI * 2);
    floorEllipse(ctx, x, y, 3, 3, 8);
    floorEllipse(ctx, W - x, y, 3, 3, 8);
  }
  ctx.fill();

  ctx.strokeStyle = colors.x;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  floorLine(ctx, W / 2 - 18, H / 2 - 18, W / 2 + 18, H / 2 + 18);
  floorLine(ctx, W / 2 + 18, H / 2 - 18, W / 2 - 18, H / 2 + 18);
  ctx.stroke();

  ctx.restore();

  ctx.strokeStyle = colors.paperEdge;
  ctx.lineWidth = 3;
  tracePaper();
  ctx.stroke();
}
