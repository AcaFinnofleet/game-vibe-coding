import { CHESS } from '../config';
import { floorRect } from './shapes';

export function paintChess(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const { square, frame, colors } = CHESS;
  const boardW = W - 2 * frame;
  const boardH = H - 2 * frame;
  // Whole squares only: stretch them a little so they fill the board exactly.
  const cols = Math.max(1, Math.round(boardW / square));
  const rows = Math.max(1, Math.round(boardH / square));
  const sw = boardW / cols;
  const sh = boardH / rows;

  ctx.fillStyle = colors.frame;
  ctx.beginPath();
  floorRect(ctx, 0, 0, W, H);
  ctx.fill();

  ctx.fillStyle = colors.light;
  ctx.beginPath();
  floorRect(ctx, frame, frame, boardW, boardH);
  ctx.fill();

  // Dark squares, with a light one in the near-right corner like on a real chess board.
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if ((cols - col + rows - row) % 2 === 1) floorRect(ctx, frame + col * sw, frame + row * sh, sw, sh);
    }
  }
  ctx.fill();

  ctx.strokeStyle = colors.frameLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  floorRect(ctx, frame, frame, boardW, boardH);
  ctx.stroke();
}
