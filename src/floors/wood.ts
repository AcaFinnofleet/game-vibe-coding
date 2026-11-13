import { WOOD } from '../config';
import { floorEllipse, floorLine, floorRect, noise } from './shapes';

export function paintWood(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { plankWidth, plankLength, knots, colors } = WOOD;
  const rows = Math.ceil(H / plankWidth);
  // Each row starts its planks at a different spot so the joints don't line up.
  const rowStart = (row: number) => -noise(row, 0) * plankLength;

  for (let row = 0; row < rows; row++) {
    const y = row * plankWidth;
    for (let i = 0, x = rowStart(row); x < W; i++, x += plankLength) {
      ctx.fillStyle = colors.planks[Math.floor(noise(row, i + 1) * colors.planks.length)];
      ctx.beginPath();
      floorRect(ctx, x, y, plankLength, plankWidth);
      ctx.fill();
      if (noise(row, i + 50) < knots) {
        const knotX = x + plankLength * (0.2 + 0.6 * noise(row, i + 99));
        ctx.fillStyle = colors.knot;
        ctx.beginPath();
        floorEllipse(ctx, knotX, y + plankWidth / 2, plankWidth * 0.3, plankWidth * 0.13);
        ctx.fill();
      }
    }
  }

  // Dark gaps between the rows and where two planks meet.
  ctx.strokeStyle = colors.gaps;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const y = row * plankWidth;
    if (row > 0) floorLine(ctx, 0, y, W, y);
    for (let x = rowStart(row) + plankLength; x < W; x += plankLength) floorLine(ctx, x, y, x, y + plankWidth);
  }
  ctx.stroke();
}
