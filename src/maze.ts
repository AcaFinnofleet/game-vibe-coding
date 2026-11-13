// The labyrinth: a grid of cells with walls between them, in world units.
// A new one is built when the game starts and whenever the arena changes size.
import { ARENA, MAZE } from './config';

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Cell {
  col: number;
  row: number;
}

let cols = 1;
let rows = 1;
let cellW = 1;
let cellH = 1;
// wallRight[row][col]: a wall between this cell and the one to its right.
// wallDown[row][col]: a wall between this cell and the one below it.
let wallRight: boolean[][] = [];
let wallDown: boolean[][] = [];
let walls: Wall[] = [];

export function buildMaze(): void {
  cols = Math.max(2, Math.round(ARENA.width / MAZE.cell));
  rows = Math.max(2, Math.round(ARENA.height / MAZE.cell));
  cellW = ARENA.width / cols;
  cellH = ARENA.height / rows;
  wallRight = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
  wallDown = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));

  // Dig paths: walk from cell to cell, knocking down walls, backing up at dead ends.
  const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack: Cell[] = [{ col: 0, row: 0 }];
  visited[0][0] = true;
  while (stack.length > 0) {
    const here = stack[stack.length - 1];
    const next = gridNeighbors(here).filter((n) => !visited[n.row][n.col]);
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(Math.random() * next.length)];
    removeWall(here, n);
    visited[n.row][n.col] = true;
    stack.push(n);
  }

  // Knock down a few extra walls, so there are loops to run around and not only dead ends.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col < cols - 1 && Math.random() < MAZE.extraOpenings) wallRight[row][col] = false;
      if (row < rows - 1 && Math.random() < MAZE.extraOpenings) wallDown[row][col] = false;
    }
  }

  const t = MAZE.wallThickness / 2;
  walls = [];
  blocks = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col < cols - 1 && wallRight[row][col]) {
        const x = (col + 1) * cellW;
        walls.push({ x1: x - t, y1: row * cellH - t, x2: x + t, y2: (row + 1) * cellH + t });
      }
      if (row < rows - 1 && wallDown[row][col]) {
        const y = (row + 1) * cellH;
        walls.push({ x1: col * cellW - t, y1: y - t, x2: (col + 1) * cellW + t, y2: y + t });
      }
    }
  }
}

// The labyrinth walls plus the brick blocks standing right now. Everything that stops things
// or blocks eyes uses this list.
export function mazeWalls(): readonly Wall[] {
  return blocks.length === 0 ? walls : [...walls, ...blocks.map((b) => b.wall)];
}

// Blocks that stand in the labyrinth for a while, like extra walls (the 🧱 monster ability).
// They don't change the paths monsters plan, so a monster may have to wait for one to go away.
let blocks: { wall: Wall; left: number }[] = [];

export function addBlock(x: number, y: number, size: number, seconds: number): void {
  const h = size / 2;
  blocks.push({ wall: { x1: x - h, y1: y - h, x2: x + h, y2: y + h }, left: seconds });
}

export function updateBlocks(dt: number): void {
  for (const b of blocks) b.left -= dt;
  blocks = blocks.filter((b) => b.left > 0);
}

export function cellOf(x: number, y: number): Cell {
  return {
    col: Math.min(cols - 1, Math.max(0, Math.floor(x / cellW))),
    row: Math.min(rows - 1, Math.max(0, Math.floor(y / cellH))),
  };
}

export function cellCenter(c: Cell): { x: number; y: number } {
  return { x: (c.col + 0.5) * cellW, y: (c.row + 0.5) * cellH };
}

// The cells you can walk to from this one without going through a wall.
export function openNeighbors(c: Cell): Cell[] {
  return gridNeighbors(c).filter((n) => !wallBetween(c, n));
}

// The first cell to walk to on the shortest way from one cell to another, or null if already there.
export function nextStep(from: Cell, to: Cell): Cell | null {
  if (from.col === to.col && from.row === to.row) return null;
  const cameFrom = new Map<number, Cell>();
  const key = (c: Cell) => c.row * cols + c.col;
  const queue: Cell[] = [from];
  cameFrom.set(key(from), from);
  while (queue.length > 0) {
    const here = queue.shift()!;
    if (here.col === to.col && here.row === to.row) {
      let step = here;
      while (key(cameFrom.get(key(step))!) !== key(from)) step = cameFrom.get(key(step))!;
      return step;
    }
    for (const n of openNeighbors(here)) {
      if (!cameFrom.has(key(n))) {
        cameFrom.set(key(n), here);
        queue.push(n);
      }
    }
  }
  return null;
}

// Push something round out of any wall it overlaps.
export function pushOutOfWalls(b: { x: number; y: number; radius: number }): void {
  for (const w of mazeWalls()) {
    const nearX = Math.min(Math.max(b.x, w.x1), w.x2);
    const nearY = Math.min(Math.max(b.y, w.y1), w.y2);
    const dx = b.x - nearX;
    const dy = b.y - nearY;
    const dist = Math.hypot(dx, dy);
    if (dist >= b.radius) continue;
    if (dist > 0) {
      b.x = nearX + (dx / dist) * b.radius;
      b.y = nearY + (dy / dist) * b.radius;
    } else {
      // The middle is inside the wall: leave by the closest side.
      const exits = [
        { d: b.x - w.x1, x: w.x1 - b.radius, y: b.y },
        { d: w.x2 - b.x, x: w.x2 + b.radius, y: b.y },
        { d: b.y - w.y1, x: b.x, y: w.y1 - b.radius },
        { d: w.y2 - b.y, x: b.x, y: w.y2 + b.radius },
      ];
      const exit = exits.reduce((a, e) => (e.d < a.d ? e : a));
      b.x = exit.x;
      b.y = exit.y;
    }
  }
}

// How far along the line from (x1, y1) to (x2, y2) the first wall is: 0 = at the start,
// 1 = no wall in the way.
export function wallHit(x1: number, y1: number, x2: number, y2: number): number {
  let nearest = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const w of mazeWalls()) {
    let tMin = 0;
    let tMax = nearest;
    for (const [start, d, lo, hi] of [
      [x1, dx, w.x1, w.x2],
      [y1, dy, w.y1, w.y2],
    ]) {
      if (d === 0) {
        if (start < lo || start > hi) tMax = -1;
        continue;
      }
      let tA = (lo - start) / d;
      let tB = (hi - start) / d;
      if (tA > tB) [tA, tB] = [tB, tA];
      tMin = Math.max(tMin, tA);
      tMax = Math.min(tMax, tB);
    }
    if (tMin <= tMax) nearest = tMin;
  }
  return nearest;
}

function gridNeighbors(c: Cell): Cell[] {
  const all = [
    { col: c.col + 1, row: c.row },
    { col: c.col - 1, row: c.row },
    { col: c.col, row: c.row + 1 },
    { col: c.col, row: c.row - 1 },
  ];
  return all.filter((n) => n.col >= 0 && n.col < cols && n.row >= 0 && n.row < rows);
}

function wallBetween(a: Cell, b: Cell): boolean {
  if (a.row === b.row) return wallRight[a.row][Math.min(a.col, b.col)];
  return wallDown[Math.min(a.row, b.row)][a.col];
}

function removeWall(a: Cell, b: Cell): void {
  if (a.row === b.row) wallRight[a.row][Math.min(a.col, b.col)] = false;
  else wallDown[Math.min(a.row, b.row)][a.col] = false;
}
