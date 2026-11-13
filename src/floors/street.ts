import { STREET } from '../config';
import { floorEllipse, floorLine, floorRect, gridStart } from './shapes';

export function paintStreet(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const S = STREET.sidewalk;
  const colors = STREET.colors;

  // Asphalt everywhere, then sidewalks along the far and near edges.
  ctx.fillStyle = colors.asphalt;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  ctx.fillStyle = colors.sidewalk;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, S);
  floorRect(ctx, 0, H - S, W, S);
  ctx.fill();

  // Square paving slabs.
  ctx.strokeStyle = colors.sidewalkLines;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gridStart(W, S); x < W; x += S) {
    floorLine(ctx, x, 0, x, S);
    floorLine(ctx, x, H - S, x, H);
  }
  ctx.stroke();

  // Curb stones where the sidewalks meet the road.
  const curb = 6;
  ctx.fillStyle = colors.curb;
  ctx.beginPath();
  floorRect(ctx, 0, S - curb, W, curb);
  floorRect(ctx, 0, H - S, W, curb);
  ctx.fill();

  drawRoadMarkings(ctx, W, S, H - S);
}

// Everything painted on the road between the two sidewalks.
function drawRoadMarkings(ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number): void {
  const mid = (top + bottom) / 2;
  const { line, dash, dashGap, crossingWidth, stripe, manholeRadius, colors } = STREET;
  const edgeInset = 8; // gap between the curb and the white edge line
  const crossingMargin = 16; // gap between the curb and the first zebra stripe

  ctx.fillStyle = colors.roadLines;
  ctx.beginPath();
  floorRect(ctx, 0, top + edgeInset, W, line);
  floorRect(ctx, 0, bottom - edgeInset - line, W, line);

  // Zebra crossing: white stripes stacked across the road, centered on the middle.
  const stripes = Math.floor((bottom - top - 2 * crossingMargin + stripe) / (2 * stripe));
  const firstStripe = mid - (stripes * 2 * stripe - stripe) / 2;
  for (let i = 0; i < stripes; i++) {
    floorRect(ctx, W / 2 - crossingWidth / 2, firstStripe + i * 2 * stripe, crossingWidth, stripe);
  }
  ctx.fill();

  // Yellow dashes from the crossing out to both ends, mirrored so both halves match.
  ctx.fillStyle = colors.centerLine;
  ctx.beginPath();
  for (let x = W / 2 + crossingWidth / 2 + dashGap; x < W; x += dash + dashGap) {
    const len = Math.min(dash, W - x);
    floorRect(ctx, x, mid - line / 2, len, line);
    floorRect(ctx, W - x - len, mid - line / 2, len, line);
  }
  ctx.fill();

  // One manhole cover on each player's half, in the near lane.
  for (const x of [W * 0.3, W * 0.7]) {
    const y = (mid + bottom) / 2;
    ctx.fillStyle = colors.manhole;
    ctx.beginPath();
    floorEllipse(ctx, x, y, manholeRadius, manholeRadius);
    ctx.fill();
    ctx.strokeStyle = colors.manholeRim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    floorEllipse(ctx, x, y, manholeRadius, manholeRadius);
    floorEllipse(ctx, x, y, manholeRadius * 0.55, manholeRadius * 0.55);
    ctx.stroke();
  }
}
