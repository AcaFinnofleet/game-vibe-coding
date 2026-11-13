// Turns world positions (ARENA units) into screen positions for the views seen from above.
// Everything drawn from above goes through project(). First person is drawn by firstperson.ts.
// The view (VIEWS in config.ts) decides how the screen is cut into viewports: one per player
// (split screen, each camera following its player) or one for both (the camera keeps both in
// view and zooms out when they run apart). project() uses the viewport picked with useViewport().
import {
  ARENA,
  CAMERA_FOLLOW,
  CAMERAS,
  type CameraName,
  PIXELS_PER_UNIT,
  VIEW,
  VIEW_START,
  type ViewName,
  VIEWS,
} from './config';

// Where the viewports sit on screen.
const TOP = 94; // room for the HUD above
const SIDE = 60; // room for the buttons on the left
const BOTTOM = 8;
const GAP = 8; // between split-screen viewports

export interface Viewport {
  left: number; // screen rectangle, in CSS pixels
  top: number;
  width: number;
  height: number;
  camX: number; // the world position in the middle of the viewport
  camY: number;
  zoom: number; // screen pixels per world unit at the near edge
}

let view: (typeof VIEWS)[ViewName] = VIEWS[VIEW_START];
// The camera seen from above. In first person it keeps the last one, which nothing draws with.
let camera = CAMERAS[view.camera === 'first-person' ? '3d' : view.camera];
let viewports: Viewport[] = [];
let current: Viewport = { left: 0, top: 0, width: 1, height: 1, camX: 0, camY: 0, zoom: PIXELS_PER_UNIT };
let players = 1; // how many players there are, for split screen

export function setView(name: ViewName): void {
  view = VIEWS[name];
  if (view.camera !== 'first-person') camera = CAMERAS[view.camera as CameraName];
  fitToScreen(VIEW.width, VIEW.height, players);
}

export function isFirstPerson(): boolean {
  return view.camera === 'first-person';
}

export function isSplit(): boolean {
  return view.split;
}

// The current view's settings, for drawing things that look different in 2D and 3D.
export function currentCamera(): (typeof CAMERAS)[CameraName] {
  return camera;
}

// Fit the screen to a new window size: one viewport per player side by side, or one for all.
export function fitToScreen(width: number, height: number, playerCount: number): void {
  VIEW.width = width;
  VIEW.height = height;
  players = playerCount;
  const count = view.split ? players : 1;
  const each = Math.max(1, (width - SIDE - GAP * (count - 1)) / count);
  viewports = Array.from({ length: count }, (_, i) => ({
    left: SIDE + i * (each + GAP),
    top: TOP,
    width: each,
    height: Math.max(1, height - TOP - BOTTOM),
    camX: viewports[i]?.camX ?? ARENA.width / 2,
    camY: viewports[i]?.camY ?? ARENA.height / 2,
    zoom: viewports[i]?.zoom ?? PIXELS_PER_UNIT,
  }));
}

export function allViewports(): readonly Viewport[] {
  return viewports;
}

// Make project() and toPixels() draw into this viewport.
export function useViewport(v: Viewport): void {
  current = v;
}

// The screen rectangle project() currently draws into.
export function currentViewport(): Viewport {
  return current;
}

// How much of the world a viewport shows at a zoom, in world units.
function seen(v: Viewport, zoom: number): { width: number; height: number } {
  return { width: v.width / zoom, height: v.height / (zoom * camera.depthSquash) };
}

// The zoom when one shared screen is zoomed out as far as it goes.
function lowestZoom(v: Viewport): number {
  // No need to zoom out further than showing the whole arena.
  const wholeArena = Math.min(v.width / ARENA.width, v.height / (ARENA.height * camera.depthSquash));
  return Math.min(PIXELS_PER_UNIT, Math.max(CAMERA_FOLLOW.minZoom, wholeArena));
}

// How far apart the players may get on one shared screen, so it can still show them both.
// Infinity on a split screen, where each player has their own camera.
export function maxApart(): { width: number; height: number } {
  if (view.split) return { width: Infinity, height: Infinity };
  const v = viewports[0];
  const most = seen(v, lowestZoom(v));
  return {
    width: Math.max(0, most.width - 2 * CAMERA_FOLLOW.margin),
    height: Math.max(0, most.height - 2 * CAMERA_FOLLOW.margin),
  };
}

// Glide each viewport's camera toward its players: its own player on a split screen, all players
// on one shared screen. jump = true skips the glide, for the first frame.
export function followPlayers(all: { x: number; y: number }[], dt: number, jump = false): void {
  const glide = jump ? 1 : Math.min(1, CAMERA_FOLLOW.smoothing * dt);
  viewports.forEach((v, i) => {
    const shown = view.split ? [all[i]] : all;
    const xs = shown.map((p) => p.x);
    const ys = shown.map((p) => p.y);
    let goalZoom = PIXELS_PER_UNIT;
    if (!view.split) {
      const m = CAMERA_FOLLOW.margin;
      const spanW = Math.max(...xs) - Math.min(...xs) + 2 * m;
      const spanH = Math.max(...ys) - Math.min(...ys) + 2 * m;
      const fit = Math.min(v.width / spanW, v.height / (spanH * camera.depthSquash));
      goalZoom = Math.min(PIXELS_PER_UNIT, Math.max(lowestZoom(v), fit));
    }
    // The camera stops at the arena edges, so it doesn't show more outside the arena than needed.
    const size = seen(v, goalZoom);
    const clampTo = (middle: number, shownSize: number, arena: number) =>
      shownSize >= arena ? arena / 2 : Math.min(Math.max(middle, shownSize / 2), arena - shownSize / 2);
    const goalX = clampTo((Math.max(...xs) + Math.min(...xs)) / 2, size.width, ARENA.width);
    const goalY = clampTo((Math.max(...ys) + Math.min(...ys)) / 2, size.height, ARENA.height);
    v.zoom += (goalZoom - v.zoom) * glide;
    v.camX += (goalX - v.camX) * glide;
    v.camY += (goalY - v.camY) * glide;
  });
}

// How far down the viewport world depth y is: 0 = far (top) edge, 1 = near (bottom) edge.
function depthInView(y: number): number {
  const h = seen(current, current.zoom).height;
  return (y - (current.camY - h / 2)) / h;
}

// How big things are at depth y: smaller toward the far (top) edge.
// Never below 0.1, so things far beyond the top of the viewport don't flip over.
export function scaleAt(y: number): number {
  return Math.max(0.1, 1 - camera.perspective * (1 - depthInView(y)));
}

// World (x, y, height z) -> screen position.
export function project(x: number, y: number, z = 0): { sx: number; sy: number; s: number } {
  const s = scaleAt(y);
  return {
    sx: current.left + current.width / 2 + (x - current.camX) * current.zoom * s,
    sy: current.top + depthInView(y) * current.height - z * current.zoom * s,
    s,
  };
}

// How many screen pixels a world length takes up at depth y.
export function toPixels(length: number, y: number): number {
  return length * current.zoom * scaleAt(y);
}
