import { BRICKS } from '../config';
import { floorEllipse, floorRect, gridStart } from './shapes';

export function paintBricks(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { stud, colors } = BRICKS;
  const r = stud * 0.3;
  const x0 = gridStart(W, stud) + stud / 2;
  const y0 = gridStart(H, stud) + stud / 2;

  ctx.fillStyle = colors.plate;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  // Each stud is three layers: its side peeking out below, the round top, and a little shine.
  const layers: [string, number, number, number][] = [
    [colors.studSide, 0, r * 0.35, r],
    [colors.studTop, 0, 0, r],
    [colors.shine, -r * 0.35, -r * 0.35, r * 0.3],
  ];
  for (const [color, dx, dy, size] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let x = x0; x < W + stud; x += stud) {
      for (let y = y0; y < H + stud; y += stud) floorEllipse(ctx, x + dx, y + dy, size, size, 10);
    }
    ctx.fill();
  }
}
