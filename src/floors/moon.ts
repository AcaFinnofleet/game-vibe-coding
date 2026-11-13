import { MOON } from '../config';
import { floorBlob, floorEllipse, floorRect, noise } from './shapes';

export function paintMoon(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { craters, rocks, colors } = MOON;

  ctx.fillStyle = colors.dust;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  ctx.fillStyle = colors.speckles;
  ctx.beginPath();
  for (let i = 0; i < (W * H) / 800; i++) floorRect(ctx, noise(i, 1) * W, noise(i, 2) * H, 2, 2);
  ctx.fill();

  // Craters: a light rim, and a dark hollow shifted toward the far-left so the near-right inside looks sunlit.
  for (let i = 0; i < craters; i++) {
    const x = noise(i, 3) * W;
    const y = noise(i, 4) * H;
    const r = 10 + noise(i, 5) ** 2 * 40; // mostly small, a few big ones
    ctx.fillStyle = colors.craterRim;
    ctx.beginPath();
    floorEllipse(ctx, x, y, r * 1.15, r * 1.15);
    ctx.fill();
    ctx.fillStyle = colors.craterFloor;
    ctx.beginPath();
    floorEllipse(ctx, x - r * 0.15, y - r * 0.15, r, r);
    ctx.fill();
  }

  ctx.fillStyle = colors.rock;
  ctx.beginPath();
  for (let i = 0; i < rocks; i++) floorBlob(ctx, noise(i, 6) * W, noise(i, 7) * H, 3 + noise(i, 8) * 5, i + 40);
  ctx.fill();
}
