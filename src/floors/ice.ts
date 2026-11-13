import { ICE } from '../config';
import { project } from '../camera';
import { floorBlob, floorCrack, floorRect, noise } from './shapes';

export function paintIce(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { cracks, scratches, colors } = ICE;

  ctx.fillStyle = colors.ice;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  // Bluish patches where the ice is thicker.
  ctx.fillStyle = colors.patches;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) floorBlob(ctx, noise(i, 1) * W, noise(i, 2) * H, 50 + noise(i, 3) * 70, i + 10);
  ctx.fill();

  // Curvy scratches left by skates: short pieces of big circles.
  ctx.strokeStyle = colors.scratches;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < scratches; i++) {
    const x = noise(i, 4) * W;
    const y = noise(i, 5) * H;
    const r = 120 + noise(i, 6) * 200;
    const start = noise(i, 7) * Math.PI * 2;
    for (let j = 0; j <= 10; j++) {
      const a = start + (j / 10) * 0.7;
      const p = project(x + r * (Math.cos(a) - Math.cos(start)), y + r * (Math.sin(a) - Math.sin(start)));
      if (j === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = colors.cracks;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < cracks; i++) {
    floorCrack(ctx, noise(i, 8) * W, noise(i, 9) * H, noise(i, 10) * Math.PI * 2, 80 + noise(i, 11) * 160, i + 1);
  }
  ctx.stroke();

  // Snowdrifts piled up along the far and near edges, each with a bluish shadow on its near side.
  const drifts: [number, number, number, number][] = [];
  for (const y of [0, H]) {
    for (let x = 0, i = 0; x < W + 45; x += 45, i++) drifts.push([x, y, 18 + noise(i, y + 12) * 22, i + y]);
  }
  ctx.fillStyle = colors.snowShade;
  ctx.beginPath();
  for (const [x, y, r, seed] of drifts) floorBlob(ctx, x, y + 5, r, seed);
  ctx.fill();
  ctx.fillStyle = colors.snow;
  ctx.beginPath();
  for (const [x, y, r, seed] of drifts) floorBlob(ctx, x, y, r, seed);
  ctx.fill();
}
