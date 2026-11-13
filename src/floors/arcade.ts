import { ARCADE } from '../config';
import { floorLine, floorRect, gridStart, noise } from './shapes';

export function paintArcade(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { tile, litTiles, litBrightness, colors } = ARCADE;
  const x0 = gridStart(W, tile);
  const y0 = gridStart(H, tile);

  ctx.fillStyle = colors.floor;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colors.grid;
  ctx.shadowColor = colors.grid;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let x = x0; x < W; x += tile) floorLine(ctx, x, 0, x, H);
  for (let y = y0; y < H; y += tile) floorLine(ctx, 0, y, W, y);
  ctx.stroke();

  // Some tiles light up. They're numbered from the middle so the same ones stay lit when the window resizes.
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12;
  for (let x = x0; x < W; x += tile) {
    for (let y = y0; y < H; y += tile) {
      const n = noise(Math.round((x - W / 2) / tile), Math.round((y - H / 2) / tile));
      if (n >= litTiles) continue;
      const color = colors.lit[Math.floor((n / litTiles) * colors.lit.length)];
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.beginPath();
      floorRect(ctx, x, y, tile, tile);
      ctx.globalAlpha = litBrightness;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }

  ctx.lineWidth = 6; // the outer half is cut off at the edge of the floor
  ctx.strokeStyle = colors.border;
  ctx.shadowColor = colors.border;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.stroke();
}
