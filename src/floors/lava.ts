import { LAVA } from '../config';
import { floorBlob, floorCrack, floorRect, noise } from './shapes';

export function paintLava(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { cracks, pulseSpeed, colors } = LAVA;
  // Goes slowly between 0.6 and 1 so the lava seems to throb.
  const pulse = 0.8 + 0.2 * Math.sin((performance.now() / 1000) * pulseSpeed);

  ctx.fillStyle = colors.rock;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  ctx.fillStyle = colors.rockPatches;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    floorBlob(ctx, noise(i, 17) * W, noise(i, 18) * H, 40 + noise(i, 19) * 60, i + 80);
    ctx.fill();
  }

  // Glowing cracks: a wide orange glow with a thin, hotter middle.
  const traceCracks = () => {
    ctx.beginPath();
    for (let i = 0; i < cracks; i++) {
      floorCrack(ctx, noise(i, 20) * W, noise(i, 21) * H, noise(i, 22) * Math.PI * 2, 100 + noise(i, 23) * 200, i + 300);
    }
  };
  ctx.lineJoin = 'round';
  ctx.globalAlpha = pulse;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 14 * pulse;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 4;
  traceCracks();
  ctx.stroke();
  ctx.strokeStyle = colors.hot;
  ctx.lineWidth = 1.5;
  traceCracks();
  ctx.stroke();

  // Lava pools, placed as mirror images so it stays fair if they ever start to hurt.
  const pools: [number, number, number][] = [
    [W / 2, H * 0.22, 40],
    [W * 0.32, H * 0.78, 32],
    [W * 0.68, H * 0.78, 32],
  ];
  ctx.shadowBlur = 24 * pulse;
  for (const [x, y, r] of pools) {
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    floorBlob(ctx, x, y, r, 7);
    ctx.fill();
    ctx.fillStyle = colors.hot;
    ctx.beginPath();
    floorBlob(ctx, x, y, r * 0.6, 7);
    ctx.fill();
  }
}
